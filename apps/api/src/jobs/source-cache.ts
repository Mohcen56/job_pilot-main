import type { BackendContext } from "../context";
import type { CareerSource } from "./providers/types";
import type { NormalizedJob } from "@jobhunt/shared/types";
import { detectProvider } from "./providers/detector";
import { validJob } from "./normalization";
type SourceRow={id:string;career_url:string;provider:string;company_identifier:string;discovery_method:CareerSource['discoveryMethod'];discovery_url:string|null;last_fetched_at:string|null;jobs_cache:NormalizedJob[];cache_query:string|null};
export class CareerSourceCache {
  private rows:SourceRow[]=[];
  constructor(private context:BackendContext) {}
  async load():Promise<CareerSource[]> {
    const result=await this.context.database.from('career_sources').select('*').order('last_used_at',{ascending:true,nullsFirst:true}).limit(100).rows<SourceRow>();
    if(result.error) throw new Error('Source cache unavailable');this.rows=result.data??[];
    return this.rows.flatMap(r=>{const s=detectProvider(r.career_url);return s?[{...s,discoveryMethod:r.discovery_method,discoveryUrl:r.discovery_url??undefined}]:[];});
  }
  read(source:CareerSource,query:string):NormalizedJob[]|null {
    const row=this.rows.find(r=>r.career_url===source.careerUrl);
    if(!row?.last_fetched_at || row.cache_query!==query || Date.now()-new Date(row.last_fetched_at).getTime()>30*60000) return null;
    return row.jobs_cache.filter(validJob);
  }
  async save(source:CareerSource,jobs:NormalizedJob[],query:string) {
    const row=this.rows.find(r=>r.career_url===source.careerUrl);
    const values={provider:source.provider,company_identifier:source.companyIdentifier,discovery_method:source.discoveryMethod,discovery_url:source.discoveryUrl??null,last_fetched_at:new Date().toISOString(),last_used_at:new Date().toISOString(),jobs_cache:jobs,cache_query:query};
    const q=this.context.database.from('career_sources');
    const result=row?await q.update(values).eq('id',row.id):await q.insert([{...values,career_url:source.careerUrl}]);
    if(result.error) console.warn('[discovery] Source cache write unavailable');
  }
  async touch(source:CareerSource) {
    await this.context.database.from('career_sources').update({last_used_at:new Date().toISOString()}).eq('career_url',source.careerUrl);
  }
  async remember(source:CareerSource) {
    if(this.rows.some(row=>row.career_url===source.careerUrl))return;
    const result=await this.context.database.from('career_sources').insert([{career_url:source.careerUrl,provider:source.provider,company_identifier:source.companyIdentifier,discovery_method:source.discoveryMethod,discovery_url:source.discoveryUrl??null,jobs_cache:[]}]).select('*').single<SourceRow>();
    if(result.data)this.rows.push(result.data);
    else console.warn('[discovery] Source registration unavailable');
  }
}
