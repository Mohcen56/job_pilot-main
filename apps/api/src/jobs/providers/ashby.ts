import type { JobProvider, ProviderSearchInput } from "./types";
import { detectProvider } from "./detector";
import { array,json,normalize,record } from "./common";
export class AshbyProvider implements JobProvider {
  readonly name='ashby' as const;
  canHandle(url:string) {return detectProvider(url)?.provider===this.name;}
  async fetchJobs(input:ProviderSearchInput) {
    const data=await json(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(input.source.companyIdentifier)}?includeCompensation=true`,input.signal);
    return array(record(data).jobs).map(record).filter(j=>j.isListed!==false).map(j=>normalize(input,{id:j.id||j.jobUrl,title:j.title,company:input.source.companyIdentifier,description:j.descriptionPlain||j.descriptionHtml,location:j.location,url:j.jobUrl,apply:j.applyUrl,published:j.publishedAt,workplace:j.workplaceType||(j.isRemote===true?'remote':undefined),employment:j.employmentType,salary:record(j.compensation).scrapeableCompensationSalarySummary})).filter(j=>j!==null);
  }
}
