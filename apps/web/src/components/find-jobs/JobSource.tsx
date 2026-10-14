import type { Job } from '@jobhunt/shared/types';
import { JOB_BOARD_LABELS } from '@jobhunt/shared/types';
const names:Record<string,string>={greenhouse:'Greenhouse',lever:'Lever',ashby:'Ashby',smartrecruiters:'SmartRecruiters',workable:'Workable',company:'Company website',adzuna:'Adzuna',jooble:'Jooble',jsearch:'JSearch'};
export function isDirectJob(job:Job) {return Boolean(job.source_provider && !['adzuna','jsearch','jooble'].includes(job.source_provider));}
export function discoveryLabel(job:Job) {
  switch(job.discovery_method) {
    case 'ats_direct':return 'Found directly through the company ATS';
    case 'company_career_page':return 'Found directly on company career page';
    case 'search_discovery':return 'Company listing discovered through search';
    case 'jsearch':return 'Found through JSearch';
    case 'adzuna':return 'Found through Adzuna';
    case 'jooble':return 'Found through Jooble';
    default:return 'Saved job listing';
  }
}
export function JobSource({job}:{job:Job}) {
  const direct=isDirectJob(job);
  const label=job.source_provider?names[job.source_provider]:job.source_board?JOB_BOARD_LABELS[job.source_board]:job.source==='url'?'URL':'Search';
  return <span title={discoveryLabel(job)} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${direct?'bg-success-lightest text-success-foreground':'bg-accent-light text-accent'}`}>{direct?'Direct · ':''}{label}</span>;
}
