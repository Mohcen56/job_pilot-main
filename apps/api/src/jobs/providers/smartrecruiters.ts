import type { JobProvider, ProviderSearchInput } from "./types";
import { detectProvider } from "./detector";
import { array,json,normalize,record,string } from "./common";
export class SmartRecruitersProvider implements JobProvider {
  readonly name='smartrecruiters' as const;
  canHandle(url:string) {return detectProvider(url)?.provider===this.name;}
  async fetchJobs(input:ProviderSearchInput) {
    const base=`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(input.source.companyIdentifier)}/postings`;
    const summaries=new Map<string,Record<string,unknown>>();
    for(const title of input.titles.slice(0,5)) {
      if(input.signal.aborted)break;
      const query=title.replace(/\b(?:junior|senior|new grad|graduate|entry level)\b/gi,'').trim();
      const result=record(await json(`${base}?${new URLSearchParams({limit:'100',q:query})}`,input.signal));
      for(const summary of array(result.content).map(record))summaries.set(string(summary.id),summary);
    }
    const jobs=[];
    for(const summary of [...summaries.values()].slice(0,150)) {
      const title=string(summary.name); if(!input.titles.some(t=>t.split(/\s+/).some(w=>w.length>3 && title.toLowerCase().includes(w.toLowerCase())))) continue;
      if(input.signal.aborted || jobs.length>=30) break;
      try {
        const j=record(await json(`${base}/${encodeURIComponent(string(summary.id))}`,input.signal));
        const l=record(j.location);const sections=record(record(j.jobAd).sections);
        const job=normalize(input,{id:j.id,title:j.name,company:record(j.company).name||input.source.companyIdentifier,description:Object.values(sections).map(record).map(x=>string(x.text)).join(' '),location:[l.city,l.region,l.country].filter(Boolean).join(', '),url:`https://jobs.smartrecruiters.com/${input.source.companyIdentifier}/${string(j.id)}`,apply:j.applyUrl,published:j.releasedDate,workplace:l.remote===true?'remote':l.workplaceType,employment:record(j.typeOfEmployment).label}); if(job) jobs.push(job);
      } catch { /* A bad detail doesn't prevent other public postings. */ }
    }
    return jobs;
  }
}
