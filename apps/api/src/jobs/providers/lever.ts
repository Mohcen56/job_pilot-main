import type { JobProvider, ProviderSearchInput } from "./types";
import { detectProvider } from "./detector";
import { array,json,normalize,record,string } from "./common";
export class LeverProvider implements JobProvider {
  readonly name='lever' as const;
  canHandle(url:string) {return detectProvider(url)?.provider===this.name;}
  async fetchJobs(input:ProviderSearchInput) {
    const eu=new URL(input.source.careerUrl).hostname==='jobs.eu.lever.co';
    const jobs=await json(`https://${eu?'api.eu.lever.co':'api.lever.co'}/v0/postings/${encodeURIComponent(input.source.companyIdentifier)}?mode=json&limit=200`,input.signal);
    return array(jobs).map(record).map(j=>{const c=record(j.categories);const salary=record(j.salaryRange);return normalize(input,{id:j.id,title:j.text,company:input.source.companyIdentifier,description:`${string(j.descriptionPlain)} ${array(j.lists).map(record).map(x=>`${string(x.text)} ${string(x.content)}`).join(' ')} ${string(j.additionalPlain)}`,location:c.location,url:j.hostedUrl,apply:j.applyUrl,workplace:j.workplaceType,employment:c.commitment,salaryMin:salary.min,salaryMax:salary.max,currency:salary.currency});}).filter(j=>j!==null);
  }
}
