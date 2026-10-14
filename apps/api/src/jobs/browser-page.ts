import Browserbase from '@browserbasehq/sdk';
import { publicAddress } from './safe-http';
import { record,string } from './providers/common';
/** Optional deterministic CDP rendering through the installed Browserbase SDK; no LLM calls. */
export async function renderCareerPage(url:string,signal:AbortSignal):Promise<string|null> {
  if(process.env.CAREER_BROWSER_FALLBACK!=='true' || !process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID)return null;
  await publicAddress(new URL(url),signal);
  const client=new Browserbase({apiKey:process.env.BROWSERBASE_API_KEY,maxRetries:0,timeout:10000});
  const session=await client.sessions.create({projectId:process.env.BROWSERBASE_PROJECT_ID,timeout:60});
  const socket=new WebSocket(session.connectUrl);const deadline=AbortSignal.any([signal,AbortSignal.timeout(15000)]);
  const pending=new Map<number,{resolve:(v:Record<string,unknown>)=>void;reject:(e:Error)=>void}>();let id=0;
  const cancel=()=>{for(const call of pending.values())call.reject(new Error('Browser deadline reached'));pending.clear();socket.close();};
  deadline.addEventListener('abort',cancel,{once:true});
  socket.addEventListener('message',event=>{
    if(typeof event.data!=='string'||event.data.length>2500000)return;
    try {const data=record(JSON.parse(event.data));const call=pending.get(Number(data.id));if(!call)return;pending.delete(Number(data.id));if(data.error)call.reject(new Error('Browser command failed'));else call.resolve(record(data.result));}catch {/* Ignore unrelated CDP events. */}
  });
  socket.addEventListener('error',cancel);socket.addEventListener('close',cancel);
  const command=(method:string,params:Record<string,unknown>={},sessionId?:string)=>new Promise<Record<string,unknown>>((resolve,reject)=>{deadline.throwIfAborted();const requestId=++id;pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method,params,...(sessionId?{sessionId}:{})}));});
  try {
    await new Promise<void>((resolve,reject)=>{const abort=()=>reject(new Error('Browser connection cancelled'));deadline.addEventListener('abort',abort,{once:true});socket.addEventListener('open',()=>{deadline.removeEventListener('abort',abort);resolve();},{once:true});socket.addEventListener('error',()=>reject(new Error('Browser connection failed')),{once:true});});
    const target=await command('Target.createTarget',{url:'about:blank'});const attached=await command('Target.attachToTarget',{targetId:target.targetId,flatten:true});const sessionId=string(attached.sessionId);
    await command('Network.enable',{},sessionId);
    await command('Network.setBlockedURLs',{urls:['*://localhost/*','*://127.*','*://10.*','*://192.168.*','*://169.254.*','*://172.1*','*://172.2*','*://172.3*','*://[::*','*://*.local/*']},sessionId);
    await command('Page.navigate',{url},sessionId);
    for(let attempt=0;attempt<12;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,500));deadline.throwIfAborted();
      const result=await command('Runtime.evaluate',{expression:'JSON.stringify({url:location.href,ready:document.readyState,html:document.documentElement.outerHTML})',returnByValue:true},sessionId);
      const value=record(JSON.parse(string(record(result.result).value)||'{}'));
      if(value.ready==='complete') {
        const final=new URL(string(value.url));await publicAddress(final,deadline);
        if(final.origin!==new URL(url).origin)return null;
        const html=string(value.html);return html.length<=2000000&&!/captcha|access denied|verify you are human/i.test(html.slice(0,8000))?html:null;
      }
    }
    return null;
  } finally {
    deadline.removeEventListener('abort',cancel);socket.close();
    await client.sessions.update(session.id,{projectId:process.env.BROWSERBASE_PROJECT_ID,status:'REQUEST_RELEASE'}).catch(()=>console.warn('[discovery] Browser release unavailable'));
  }
}
