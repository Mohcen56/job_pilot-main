import { COUNTRIES } from '@jobhunt/shared/countries';
import type { GeographicEligibility, NormalizedJob, JobProviderName } from "@jobhunt/shared/types";
export function validPublicUrl(value: string): boolean {
  try {
    const u=new URL(value); const h=u.hostname.toLowerCase();
    return /^https?:$/.test(u.protocol) && !u.username && !u.password && (!u.port || ['80','443'].includes(u.port)) && h.includes('.') && !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) && !h.endsWith('.local') && !h.includes(':');
  } catch { return false; }
}
export function canonicalUrl(value: string): string {
  if (!validPublicUrl(value)) return '';
  const u=new URL(value); u.hash='';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|source$|src$|tracking|gh_src$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort(); u.pathname=u.pathname.replace(/\/$/,'') || '/'; return u.href;
}
export function plainText(value: string): string {
  let s=value;
  for(let i=0;i<2;i++) s=s.replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#(?:39|x27);/gi,"'").replace(/&nbsp;/gi,' ');
  return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,30000);
}
export function publicationDate(value: unknown): string | null {
  if(typeof value!=='string' && typeof value!=='number') return null;
  const d=new Date(value); return Number.isFinite(d.getTime()) && d.getTime()<=Date.now()+86400000 ? d.toISOString():null;
}
export function validJob(job: NormalizedJob): boolean {
  return Boolean(job.title.trim() && job.company.trim() && job.source && job.externalId && validPublicUrl(job.sourceUrl) && validPublicUrl(job.applyUrl));
}
const priority: Record<JobProviderName,number>={company:0,greenhouse:0,lever:0,ashby:0,smartrecruiters:0,workable:0,jsearch:2,adzuna:2,jooble:2};
export const sourcePriority=(source: JobProviderName)=>priority[source];
const textKey=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function jobKeys(job: Pick<NormalizedJob,'source'|'externalId'|'title'|'company'|'location'|'applyUrl'>): string[] {
  return [`id:${job.source}:${job.externalId}`,`url:${canonicalUrl(job.applyUrl)}`,`role:${textKey(job.company)}|${textKey(job.title)}|${textKey(job.location)}`];
}
export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const retained: NormalizedJob[]=[]; const keys=new Map<string,NormalizedJob>();
  const completeness=(job:NormalizedJob)=>(job.publishedAt?3:0)+(job.description?2:0)+(job.salary?1:0);
  for(const job of jobs.filter(validJob).sort((a,b)=>sourcePriority(a.source)-sourcePriority(b.source)||completeness(b)-completeness(a))) {
    const identifiers=jobKeys(job); const duplicate=identifiers.map(k=>keys.get(k)).find(Boolean);
    if(duplicate) { for(const k of identifiers) keys.set(k,duplicate); continue; }
    retained.push(job); for(const k of identifiers) keys.set(k,job);
  }
  return retained;
}
const europe=new Set('al ad at ax by be ba bg hr cy cz dk ee fo fi fr de gi gr gg va hu is ie im it je xk lv li lt lu mt md mc me nl mk no pl pt ro ru sm rs sk si es sj se ch tr ua gb'.split(' '));
const eu=new Set('de fr es it nl be at pl pt ie dk se fi gr cz ro hu bg hr cy ee lv lt lu mt si sk'.split(' '));
const emea = new Set([...europe,...'dz ao bj bw bf bi cv cm cf td km cg cd ci dj eg gq er sz et ga gm gh gn gw ke ls lr ly mg mw ml mr mu ma mz na ne ng rw st sn sc sl so za ss sd tz tg tn ug zm zw eh re yt ae bh ir iq il jo kw lb om ps qa sa sy ye'.split(' ')]);
const aliases: Record<string,string[]> = {us:['United States of America','United States','USA','US'],tr:['Turkey','T\u00fcrkiye','Turkiye'],gb:['United Kingdom','UK'],kr:['South Korea'],kp:['North Korea'],ru:['Russia'],cz:['Czech Republic'],vn:['Vietnam'],tw:['Taiwan']};
const countryLabels = COUNTRIES.flatMap(({code,name})=>[name,...aliases[code]??[]].map(label=>({code,label}))).sort((a,b)=>b.label.length-a.label.length);
const escapePattern = (value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function mentionedCountries(text:string,restricted=false): string[] {
  const found = new Set<string>(); let remaining=text;
  for (const {code,label} of countryLabels) {
    // Short codes must be uppercase to avoid ordinary words such as "us" or "in".
    const flags = label.length<=3 ? 'g' : 'gi';
    const name=escapePattern(label);
    const pattern=restricted ? new RegExp(`\\b(?:${name}(?:[- ]based|\\s+only)|only (?:in |within )?(?:the )?${name}|(?:must|need to|should) (?:be (?:located|based)|reside|live) (?:in|within) (?:the )?${name})\\b`,flags) : new RegExp(`(?<![\\p{L}])${name}(?![\\p{L}])`,flags+'u');
    if(pattern.test(remaining)) {found.add(code);remaining=remaining.replace(pattern,' ');}
  }
  return [...found];
}
export function geographicEligibility(job: Pick<NormalizedJob,'location'|'description'|'workplaceType'>, country: string): GeographicEligibility {
  const header=job.location; const text=`${header}. ${job.description}`;
  const base: GeographicEligibility={scope:'unknown',countries:[],status:'unknown',evidence:'Remote eligibility is not specified.'};
  if(job.workplaceType!=='remote') return {...base,evidence:'Local workplace; check the listed location.'};
  // Restriction evidence wins over broad remote marketing language. Ignore incidental country mentions.
  const found=mentionedCountries(text,true);
  if(found.length) return {scope:'countries',countries:found,status:country?found.includes(country)?'eligible':'ineligible':'unknown',evidence:'Explicit country restriction in listing'};
  for(const [scope,pattern,allowed] of [['eu',/\b(?:EU|European Union)(?:\s+only)?\b/i,eu],['emea',/\bEMEA\b/i,emea],['europe',/\bEurope(?:an countries)?\b/i,europe]] as const) {
    if(pattern.test(header) || new RegExp(`(?:remote|based|located|reside|work)\\s+(?:in |within |across |from )?(?:the )?${scope==='eu'?'(?:EU|European Union)':scope}\\b`, 'i').test(text)) return {scope,countries:[],status:country?allowed.has(country)?'eligible':'ineligible':'unknown',evidence:`Remote ${scope.toUpperCase()}`};
  }
  if(/\b(?:worldwide|anywhere in the world|globally remote|work from anywhere)\b/i.test(header) || /\b(?:remote (?:worldwide|globally)|worldwide remote|globally remote|(?:work|hire|hiring) (?:from )?(?:anywhere in the world|anywhere)|work from anywhere)\b/i.test(job.description)) return {scope:'worldwide',countries:[],status:'eligible',evidence:'Explicit worldwide remote'};
  // A country on a remote listing describes a practical restriction unless worldwide is explicit.
  const located=mentionedCountries(header);
  if(located.length) return {scope:'countries',countries:located,status:country?located.includes(country)?'eligible':'ineligible':'unknown',evidence:`Remote location: ${header}`};
  return base;
}
export function seniority(title:string,description:string,years:number|null=0): Pick<NormalizedJob,'experienceLevel'|'seniorityMatch'> {
  const t=title.toLowerCase(); const m=description.match(/\b(\d{1,2})(?:\s*[-–to]+\s*(\d{1,2}))?\+?\s+years?(?:\s+of)?\s+(?:professional |relevant |work )?experience/i);
  const minimum=m?Number(m[1]):null; const y=years ?? 0;
  const level=/\b(senior|staff|principal|lead|manager|director)\b/.test(t)?'senior':/\b(intern|internship|graduate|new grad|entry[- ]level|junior|associate)\b/.test(t)?'junior':/\bmid\b/.test(t)?'mid':minimum!==null?minimum<=2?'junior':minimum<=4?'mid':'senior':'unknown';
  return {experienceLevel:level,seniorityMatch:minimum!==null?minimum<=y?'strong':minimum<=y+2?'stretch':'poor':level==='junior'?'strong':level==='senior' && y<3?'poor':'unknown'};
}
export function matchesRole(job: NormalizedJob, titles: string[]): boolean {
  return titles.some(t=>{ const words=textKey(t).split(' ').filter(w=>!['junior','senior','intern','graduate','new','grad','entry','level','and','or'].includes(w)); return words.length>0 && words.some(w=>textKey(job.title).split(' ').includes(w) || ((w==='developer'||w==='engineer') && /developer|engineer/i.test(job.title))); });
}
