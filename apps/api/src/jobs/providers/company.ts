import type { JobProvider, ProviderSearchInput } from "./types";
import type { NormalizedJob } from "@jobhunt/shared/types";
import { array,record,string,normalize } from "./common";
import { CrawlBudget } from "../safe-http";
import { canonicalUrl, validPublicUrl } from "../normalization";
import { detectProvider } from "./detector";
import { renderCareerPage } from '../browser-page';
export function structuredJobs(html:string,url:string,input:ProviderSearchInput):NormalizedJob[] {
  const jobs:NormalizedJob[]=[];
  function visit(value:unknown,depth=0) {
    if(depth>12) return;
    if(Array.isArray(value)) {value.slice(0,500).forEach(v=>visit(v,depth+1));return;}
    const j=record(value);if(!Object.keys(j).length) return;
    if(j['@type']==='JobPosting' || array(j['@type']).includes('JobPosting')) {
      const address=record(record(Array.isArray(j.jobLocation)?j.jobLocation[0]:j.jobLocation).address);
      const salary=record(record(j.baseSalary).value);
      const resolve=(v:unknown)=>{try{return new URL(string(v)||url,url).href;}catch{return '';}};
      const job=normalize(input,{id:record(j.identifier).value||j.url||url,title:j.title,company:record(j.hiringOrganization).name,description:j.description,location:[address.addressLocality,address.addressRegion,typeof address.addressCountry==='string'?address.addressCountry:record(address.addressCountry).name].filter(Boolean).join(', '),url:resolve(j.url),apply:resolve(j.applicationUrl||j.url),published:j.datePosted,workplace:j.jobLocationType==='TELECOMMUTE'?'remote':undefined,employment:Array.isArray(j.employmentType)?j.employmentType.join(', '):j.employmentType,salaryMin:salary.minValue||salary.value,salaryMax:salary.maxValue,currency:record(j.baseSalary).currency});
      if(job) {
        const eligible=array(j.applicantLocationRequirements).map(record).map(x=>string(x.name));
        if(!eligible.length && record(j.applicantLocationRequirements).name) eligible.push(string(record(j.applicantLocationRequirements).name));
        if(eligible.length) job.location=`${job.location} Remote ${eligible.join(', ')}`.trim();
        jobs.push(job);
      }
      return;
    }
    Object.values(j).slice(0,300).forEach(v=>visit(v,depth+1));
  }
  // Parse only JSON scripts, including JSON-LD and framework data containing actual JobPosting objects.
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {visit(JSON.parse(match[1]));} catch { /* Ignore unrelated/malformed embedded data. */ }
  }
  return jobs;
}
export function careerLinks(html:string,base:string):string[] {
  const origin=new URL(base).origin; const links:string[]=[];
  for(const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {const u=new URL(match[1].replace(/&amp;/g,'&'),base);if(!validPublicUrl(u.href))continue;
      const provider=detectProvider(u.href);const isAts=provider && provider.provider!=='company';
      if(isAts || (u.origin===origin && /career|vacanc|opening|position|\/jobs?(?:\/|\?|$)/i.test(`${u.pathname} ${match[2]}`))) links.push(canonicalUrl(u.href));
    } catch { /* Not a usable link. */ }
  }
  // Framework page data can expose ATS job URLs without rendering an anchor. Extract only recognized ATS hosts.
  const decoded=html.replace(/\\\//g,'/');
  for(const match of decoded.matchAll(/https:\/\/(?:boards(?:\.eu)?\.greenhouse\.io|job-boards\.greenhouse\.io|jobboards\.greenhouse\.io|jobs(?:\.eu)?\.lever\.co|jobs\.ashbyhq\.com|(?:careers|jobs)\.smartrecruiters\.com|apply\.workable\.com)\/[^\s"'<>\\]+/gi)) {
    if(detectProvider(match[0]))links.push(canonicalUrl(match[0]));
  }
  return [...new Set(links)].slice(0,20);
}
export function robotsAllows(text:string,path:string):boolean {
  let applies=false;
  for(const line of text.split(/\r?\n/)) {
    const clean=line.split('#')[0].trim(); const match=clean.match(/^([^:]+):\s*(.*)$/); if(!match) continue;
    if(match[1].toLowerCase()==='user-agent') applies=/^(\*|jobhuntez)$/i.test(match[2]);
    if(applies && match[1].toLowerCase()==='disallow' && match[2] && path.startsWith(match[2].replace(/\*.*$/,''))) return false;
  } return true;
}
export class GenericCareerPageProvider implements JobProvider {
  readonly name='company' as const;
  readonly discoveredSources:string[]=[];
  canHandle(url:string) {return detectProvider(url)?.provider==='company';}
  async fetchJobs(input:ProviderSearchInput) {
    const budget=new CrawlBudget();const visited=new Set<string>();const jobs:NormalizedJob[]=[];
    const robots=new Map<string,string>();const queue=[{url:input.source.careerUrl,depth:0}];
    while(queue.length && visited.size<5 && !input.signal.aborted) {
      const item=queue.shift()!;if(visited.has(item.url))continue;visited.add(item.url);
      try {
        const u=new URL(item.url);
        if(!robots.has(u.origin)) {const r=await budget.fetch(`${u.origin}/robots.txt`,input.signal);if([401,403,429].includes(r.status)) continue;robots.set(u.origin,r.status===200?r.html:'');}
        if(!robotsAllows(robots.get(u.origin)??'',u.pathname))continue;
        const page=await budget.fetch(item.url,input.signal);if(page.status!==200 || /captcha|access denied|verify you are human/i.test(page.html.slice(0,8000)))continue;
        let html=page.html;
        let parsed=structuredJobs(html,page.url,input);
        if(!parsed.length && /<script[^>]+src=|id=["'](?:root|app|__next)["']/i.test(html)) {
          try {html=await renderCareerPage(page.url,input.signal)??html;parsed=structuredJobs(html,page.url,input);}catch {/* Optional JS rendering cannot stop HTTP extraction. */}
        }
        jobs.push(...parsed);
        for(const link of careerLinks(html,page.url)) {
          if(detectProvider(link)?.provider!=='company') {this.discoveredSources.push(link);continue;}
          if(item.depth<2)queue.push({url:link,depth:item.depth+1});
        }
      } catch { /* A blocked or malformed page must not stop discovery. */ }
    }
    return jobs;
  }
}
