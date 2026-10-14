import type { BackendContext } from '../context';
import { getPool } from '../database/pool';
import type { Job,NormalizedJob } from '@jobhunt/shared/types';
import { canonicalUrl,jobKeys,sourcePriority,validJob } from './normalization';
export function listingMetadata(job:NormalizedJob) {
  return {source:'search' as const,source_board:job.sourceBoard??(job.source==='jooble'?'jooble':job.source==='adzuna'?'adzuna':'direct'),
    source_provider:job.source,external_id:job.externalId,source_url:job.sourceUrl,external_apply_url:job.applyUrl,canonical_apply_url:canonicalUrl(job.applyUrl),
    title:job.title,company:job.company,location:job.location||null,salary:job.salary??null,job_type:job.employmentType??null,about_role:job.description,
    published_at:job.publishedAt,workplace_type:job.workplaceType,geographic_eligibility:job.eligibility,experience_level:job.experienceLevel,seniority_match:job.seniorityMatch,
    discovery_method:job.discoveryMethod,discovery_url:job.discoveryUrl??null,salary_min:job.salaryMin??null,salary_max:job.salaryMax??null,salary_currency:job.currency??null};
}
export function savedJobKeys(job:Job):string[] {
  return jobKeys({source:job.source_provider??(job.source_board==='adzuna'?'adzuna':'jsearch'),externalId:job.external_id??job.id,title:job.title??'',company:job.company??'',location:job.location??'',applyUrl:job.external_apply_url??job.source_url??''});
}
/** Short per-user transaction prevents duplicate concurrent imports and never rewrites tailoring/research. */
export async function saveDiscoveredJobs(context:BackendContext,jobs:NormalizedJob[],runId:string) {
  if(!context.user)throw new Error('Unauthorized');
  const client=await getPool().connect();const saved:Job[]=[];let inserted=0;let updated=0;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 34192))',[context.user.id]);
    const previous=await client.query<Job>('SELECT * FROM jobs WHERE user_id=$1',[context.user.id]);
    const keys=new Map<string,Job>();for(const row of previous.rows)for(const k of savedJobKeys(row))keys.set(k,row);
    for(const job of jobs.filter(validJob)) {
      const identifiers=jobKeys(job);const existing=identifiers.map(k=>keys.get(k)).find(Boolean);
      const metadata=listingMetadata(job);
      let row:Job;
      if(existing) {
        const oldPriority=existing.source_provider?sourcePriority(existing.source_provider):3;
        if(sourcePriority(job.source)>oldPriority) {saved.push(existing);continue;}
        // Keep a genuine known publication date if a later provider response omits it.
        metadata.published_at=job.publishedAt??existing.published_at??null;
        metadata.about_role=job.description||existing.about_role||'';
        const entries=Object.entries(metadata);const values=entries.map(([key,value])=>key==='geographic_eligibility'?JSON.stringify(value):value);
        const result=await client.query<Job>(`UPDATE jobs SET ${entries.map(([key],i)=>`"${key}"=$${i+1}`).join(',')} WHERE id=$${values.length+1} AND user_id=$${values.length+2} RETURNING *`,[...values,existing.id,context.user.id]);
        row=result.rows[0];updated++;
        if(existing.about_role!==metadata.about_role || existing.title!==job.title || existing.location!==(job.location||null)) {
          const pending=await client.query<Job>("UPDATE jobs SET match_score=NULL,match_status='pending',match_profile_hash=NULL,match_reason=NULL,matched_skills='{}',missing_skills='{}' WHERE id=$1 AND user_id=$2 RETURNING *",[row.id,context.user.id]);row=pending.rows[0];
        }
      } else {
        const data={...metadata,user_id:context.user.id,run_id:runId,found_at:job.discoveredAt,match_score:null,match_status:'pending',match_reason:null,matched_skills:[],missing_skills:[]};
        const entries=Object.entries(data);const result=await client.query<Job>(`INSERT INTO jobs (${entries.map(([key])=>`"${key}"`).join(',')}) VALUES (${entries.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,entries.map(([key,value])=>key==='geographic_eligibility'?JSON.stringify(value):value));
        row=result.rows[0];inserted++;
      }
      saved.push(row);for(const k of [...identifiers,...savedJobKeys(row)])keys.set(k,row);
    }
    await client.query('COMMIT');return {jobs:saved,inserted,updated};
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
}
