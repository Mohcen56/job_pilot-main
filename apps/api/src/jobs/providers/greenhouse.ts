import type { JobProvider, ProviderSearchInput } from "./types";
import { detectProvider } from "./detector";
import { array,json,normalize,record,string,parallelMap } from "./common";
import { matchesRole } from "../normalization";
export class GreenhouseProvider implements JobProvider {
  readonly name='greenhouse' as const;
  canHandle(url:string) {return detectProvider(url)?.provider===this.name;}
  async fetchJobs(input:ProviderSearchInput) {
    const base=`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(input.source.companyIdentifier)}`;
    const [list,board]=await Promise.all([json(`${base}/jobs`,input.signal),json(base,input.signal).catch(()=>null)]);
    const company=string(record(board).name)||input.source.companyIdentifier;
    const jobs=array(record(list).jobs).map(record).filter(j=>j.internal_job_id!==null).map(j=>normalize(input,{id:j.id,title:j.title,company,description:j.content,location:record(j.location).name,url:j.absolute_url,published:j.first_published})).filter(j=>j!==null).filter(j=>matchesRole(j,input.titles)).slice(0,30);
    // The list's updated_at is not a publication date. Retrieve first_published only on matching detail records.
    await parallelMap(jobs,2,async job=>{
      if(input.signal.aborted)return;
      try {const detail=record(await json(`${base}/jobs/${encodeURIComponent(job.externalId)}`,input.signal)); const improved=normalize(input,{id:detail.id,title:detail.title,company:detail.company_name||company,description:detail.content,location:record(detail.location).name,url:detail.absolute_url,published:detail.first_published}); if(improved) Object.assign(job,improved); } catch { /* Valid list record survives optional detail failure. */ }
    });
    return jobs;
  }
}
