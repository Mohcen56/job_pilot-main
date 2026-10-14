import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import type { RequestOptions } from 'node:http';
import { isIP } from "node:net";
import { validPublicUrl } from "./normalization";
export function isPublicAddress(ip:string):boolean {
  if(isIP(ip)===4) {const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0))||(a===198&&(b===18||b===19)));}
  // Only globally routed unicast IPv6. Reject mapped IPv4, local/link-local and special transition ranges.
  return isIP(ip)===6 && /^[23]/.test(ip) && !/^(2001:(?:db8|0:)|2002:)/i.test(ip);
}
export async function publicAddress(url:URL,signal:AbortSignal) {
  if(!validPublicUrl(url.href)) throw new Error('Unsafe career URL');
  if (/(?:^|\.)(linkedin\.com|indeed\.com|stepstone\.[a-z.]+)$/i.test(url.hostname)) throw new Error('Unsupported career source');
  signal.throwIfAborted();
  const addresses=await new Promise<Awaited<ReturnType<typeof lookup>>>((resolve,reject)=>{
    const abort=()=>reject(new Error('DNS deadline reached'));
    signal.addEventListener('abort',abort,{once:true});
    lookup(url.hostname).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
  if(!isPublicAddress(addresses.address)) throw new Error('Private career address');
  return addresses;
}
/** Pin DNS resolution into the socket. Validate every redirect; never forward cookies/credentials. */
export async function fetchPublicPage(value:string,signal:AbortSignal,redirects=0):Promise<{html:string;url:string;status:number}> {
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(10000)]);const url=new URL(value);const address=await publicAddress(url,deadline);
  const response=await new Promise<{body:string;status:number;location?:string}>((resolve,reject)=>{
    const options:RequestOptions & {autoSelectFamily:boolean}={signal:deadline,agent:false,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,address.address,address.family),headers:{'User-Agent':'JobHuntEZ/1.0 (public career discovery)','Accept':'text/html,application/json,text/plain'}};
    const req=(url.protocol==='https:'?httpsRequest:httpRequest)(url,options,res=>{
      const chunks:Buffer[]=[];let bytes=0;
      res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>2000000) {res.destroy(new Error('Career page too large'));return;} chunks.push(chunk);});
      res.on('end',()=>resolve({body:Buffer.concat(chunks).toString('utf8'),status:res.statusCode??500,location:res.headers.location}));res.on('error',reject);
    });req.on('error',reject);req.end();
  });
  if([301,302,303,307,308].includes(response.status)) {
    if(redirects>=3 || !response.location) throw new Error('Career redirect limit');
    return fetchPublicPage(new URL(response.location,url).href,signal,redirects+1);
  }
  return {html:response.body,url:url.href,status:response.status};
}
export class CrawlBudget {
  private last=new Map<string,number>(); private count=new Map<string,number>();
  async fetch(url:string,signal:AbortSignal):Promise<{html:string;url:string;status:number}> {
    const host=new URL(url).hostname;const count=this.count.get(host)??0;if(count>=7) throw new Error('Domain page budget reached');this.count.set(host,count+1);
    const wait=Math.max(0,(this.last.get(host)??0)+350-Date.now());this.last.set(host,Date.now()+wait);
    if(wait) await new Promise<void>((resolve,reject)=>{const id=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},wait);const abort=()=>{clearTimeout(id);reject(new Error('Crawl cancelled'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted) abort();});
    const page=await fetchPublicPage(url,signal);
    // Retry one transient public GET, never access-control/anti-bot failures.
    if([429,502,503,504].includes(page.status) && count<6 && !signal.aborted) {
      await new Promise(resolve=>setTimeout(resolve,500));return this.fetch(url,signal);
    }
    return page;
  }
}
