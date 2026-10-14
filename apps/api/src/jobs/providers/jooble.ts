import type { NormalizedJob } from "@jobhunt/shared/types";
import { json,array,record,normalize } from "./common";
import type { SearchJobProvider } from './types';
import type { SearchTarget } from '../legacy-discovery';
import { countryForLocation } from '@jobhunt/shared/countries';
type Connection = { apiKey: string; host: string };
function connection(country: string): Connection | null {
  if (!countryForLocation(country)) return null;
  let regions: Record<string,unknown> = {};
  try { regions = record(JSON.parse(process.env.JOOBLE_REGIONS || '{}')); } catch { return null; }
  const region = record(regions[country]);
  const legacyCountry = countryForLocation(process.env.JOOBLE_COUNTRY || 'us');
  const apiKey = typeof region.apiKey === 'string' ? region.apiKey.trim() : country === legacyCountry ? process.env.JOOBLE_API_KEY?.trim() : '';
  const host = typeof region.host === 'string' ? region.host : country === legacyCountry ? process.env.JOOBLE_HOST || (country === 'us' ? 'jooble.org' : `${country === 'gb' ? 'uk' : country}.jooble.org`) : '';
  if (!apiKey || (host === 'jooble.org' && country !== 'us') || !/^(?:[a-z]{2}\.)?jooble\.org$/.test(host)) return null;
  return {apiKey,host};
}
export class JoobleProvider implements SearchJobProvider {
  readonly name='jooble' as const;
  isConfigured(country?: string) {
    if (country) return Boolean(connection(country));
    let regions: Record<string,unknown> = {};
    try { regions = record(JSON.parse(process.env.JOOBLE_REGIONS || '{}')); } catch { return false; }
    return Boolean(connection(countryForLocation(process.env.JOOBLE_COUNTRY || 'us')) || Object.keys(regions).some(code=>connection(code)));
  }
  async search(target:SearchTarget,signal:AbortSignal):Promise<NormalizedJob[]> {
    const config = connection(target.country);
    if (!config) return [];
    const title=target.title;const location=target.remote?'remote':target.location;
    const origin = `https://${config.host}`;
    const data=record(await json(`${origin}/api/${encodeURIComponent(config.apiKey)}`,signal,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({keywords:title,location,page:1})}));
    const input={source:{provider:this.name,companyIdentifier:`jooble-${target.country}`,careerUrl:origin,discoveryMethod:'jooble' as const},signal,titles:[title]};
    // Jooble's updated field is not a trustworthy posting date.
    return array(data.jobs).map(record).map(j=>normalize(input,{id:j.id ? `${target.country}:${j.id}` : '',title:j.title,company:j.company,description:j.snippet,location:j.location,url:j.link,salary:j.salary,employment:j.type})).filter(j=>j!==null).slice(0,20);
  }
}
