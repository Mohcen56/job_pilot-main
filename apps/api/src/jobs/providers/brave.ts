import { json,array,record,string } from "./common";
import { detectProvider } from "./detector";
import type { CareerSource,CompanyDiscoveryProvider } from "./types";
export function discoveryQueries(titles:string[],locations:string[],skills:string[]) {
  const local=locations.filter(l=>!/^remote$/i.test(l));const skill=skills.slice(0,2).join(' ');
  const templates=['careers','site:boards.greenhouse.io OR site:job-boards.greenhouse.io','site:jobs.lever.co OR site:jobs.eu.lever.co','site:jobs.ashbyhq.com','site:careers.smartrecruiters.com OR site:apply.workable.com','careers'];
  return templates.map((template,index)=>{const title=titles[index%titles.length]??'';const location=index===5 && locations.some(l=>/^remote$/i.test(l))?'remote worldwide':local[index%Math.max(local.length,1)]??'';return `"${title}" ${location} ${template} ${index===0||index===5?skill:''}`.trim().slice(0,600);});
}
export class BraveDiscoveryProvider implements CompanyDiscoveryProvider {
  isConfigured() {return Boolean(process.env.SEARCH_API_KEY?.trim());}
  async discover(query:string,signal:AbortSignal):Promise<CareerSource[]> {
    const data=record(await json(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({q:query,count:'5'})}`,signal,{headers:{'X-Subscription-Token':process.env.SEARCH_API_KEY!,'Accept':'application/json'}}));
    return array(record(data.web).results).map(record).flatMap(item=>{
      const url=string(item.url);if(/(?:^|\.)(linkedin\.com|indeed\.com|stepstone\.[a-z.]+)$/i.test((()=>{try{return new URL(url).hostname;}catch{return '';}})()))return [];
      const source=detectProvider(url);return source?[{...source,discoveryMethod:'search_discovery' as const,discoveryUrl:url}]:[];
    });
  }
}
