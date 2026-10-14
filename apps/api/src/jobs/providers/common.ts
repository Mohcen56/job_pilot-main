import type { NormalizedJob, WorkplaceType } from "@jobhunt/shared/types";
import type { ProviderSearchInput } from "./types";
import { plainText, publicationDate, validJob, seniority } from "../normalization";
export function record(value: unknown): Record<string,unknown> { return typeof value==='object' && value!==null && !Array.isArray(value) ? value as Record<string,unknown> : {}; }
export function string(value: unknown): string { return typeof value==='string'?value:typeof value==='number'?String(value):''; }
export function array(value: unknown): unknown[] { return Array.isArray(value)?value:[]; }
export function number(value: unknown): number | undefined { return typeof value==='number' && Number.isFinite(value)?value:undefined; }
export function workplace(value: unknown, location=''): WorkplaceType {
  const text=string(value).toLowerCase().replace(/[_-]/g,'');
  if(text==='remote') return 'remote'; if(text==='hybrid') return 'hybrid'; if(['onsite','office'].includes(text)) return 'onsite';
  return /\bhybrid\b/i.test(location)?'hybrid':/\bremote\b/i.test(location)?'remote':'unknown';
}
export function normalize(input: ProviderSearchInput, data: {id:unknown;title:unknown;company?:unknown;description?:unknown;location?:unknown;url:unknown;apply?:unknown;published?:unknown;workplace?:unknown;employment?:unknown;salaryMin?:unknown;salaryMax?:unknown;currency?:unknown;salary?:unknown}): NormalizedJob | null {
  const location=string(data.location); const description=plainText(string(data.description));
  const job: NormalizedJob={externalId:string(data.id),title:plainText(string(data.title)),company:plainText(string(data.company)),description,location,
    source:input.source.provider,sourceUrl:string(data.url),applyUrl:string(data.apply)||string(data.url),publishedAt:publicationDate(data.published),
    workplaceType:workplace(data.workplace,location),employmentType:string(data.employment)||undefined,discoveredAt:new Date().toISOString(),
    discoveryMethod:input.source.discoveryMethod,discoveryUrl:input.source.discoveryUrl ?? input.source.careerUrl,
    salaryMin:number(data.salaryMin),salaryMax:number(data.salaryMax),currency:string(data.currency)||undefined,salary:string(data.salary)||undefined,
    ...seniority(string(data.title),description),eligibility:{scope:'unknown',countries:[],status:'unknown',evidence:'Not evaluated'}};
  if(job.salaryMin!==undefined && job.currency && !job.salary) job.salary=`${job.currency} ${job.salaryMin}${job.salaryMax===undefined?'':` – ${job.salaryMax}`}`;
  return validJob(job)?job:null;
}
export class ProviderHttpError extends Error { constructor(public readonly status:number) { super('Provider HTTP failure'); } }
export async function json(url:string,signal:AbortSignal,options:RequestInit={},redirectHosts:string[]=[],redirectCount=0,retried=false):Promise<unknown> {
  const response=await fetch(url,{...options,signal:AbortSignal.any([signal,AbortSignal.timeout(12000)]),redirect:'manual'});
  if([301,302,303,307,308].includes(response.status)) {
    const location=response.headers.get('location');if(!location||redirectCount>=3)throw new Error('Provider redirect rejected');
    const next=new URL(location,url);if(next.protocol!=='https:'||!redirectHosts.includes(next.hostname)||next.username||next.password)throw new Error('Provider redirect rejected');
    await response.body?.cancel();return json(next.href,signal,options,redirectHosts,redirectCount+1,retried);
  }
  if(!response.ok) {
    await response.body?.cancel();
    if (!retried && options.method !== 'POST' && [502,503,504].includes(response.status) && !signal.aborted) {
      await new Promise(resolve=>setTimeout(resolve,500));
      return json(url,signal,options,redirectHosts,redirectCount,true);
    }
    throw new ProviderHttpError(response.status);
  }
  if(Number(response.headers.get('content-length'))>4000000) throw new Error('Provider response too large');
  const reader=response.body?.getReader(); if(!reader) throw new Error('Empty provider response');
  const chunks:Uint8Array[]=[];let bytes=0;
  try { while(true) { const result=await reader.read(); if(result.done) break; bytes+=result.value.length; if(bytes>4000000) throw new Error('Provider response too large'); chunks.push(result.value); } }
  finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export async function parallelMap<T,R>(values:T[],limit:number,work:(value:T)=>Promise<R>):Promise<PromiseSettledResult<R>[]> {
  const results:PromiseSettledResult<R>[]=[];let cursor=0;
  await Promise.all(Array.from({length:Math.min(values.length,limit)},async()=>{ while(cursor<values.length) { const index=cursor++; try {results[index]={status:'fulfilled',value:await work(values[index])};} catch(reason) {results[index]={status:'rejected',reason};} } })); return results;
}
