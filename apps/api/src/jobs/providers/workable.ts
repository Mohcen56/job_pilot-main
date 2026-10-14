import type { JobProvider, ProviderSearchInput } from "./types";
import { detectProvider } from "./detector";
import { array,json,normalize,record } from "./common";
export class WorkableProvider implements JobProvider {
  readonly name='workable' as const;
  canHandle(url:string) {return detectProvider(url)?.provider===this.name;}
  async fetchJobs(input:ProviderSearchInput) {
    const data=record(await json(`https://www.workable.com/api/accounts/${encodeURIComponent(input.source.companyIdentifier)}?details=true`,input.signal,{},['www.workable.com','apply.workable.com']));
    return array(data.jobs).map(record).map(j=>normalize(input,{id:j.shortcode||j.code,title:j.title,company:data.name,description:j.description,location:[j.city,j.state,j.country].filter(Boolean).join(', '),url:j.shortlink||j.application_url||j.url,apply:j.url||j.application_url,published:j.published_on,workplace:j.workplace_type||(j.telecommuting===true?'remote':undefined),employment:j.employment_type})).filter(j=>j!==null);
  }
}
