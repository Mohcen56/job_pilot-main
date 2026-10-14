import type { NormalizedJob } from "@jobhunt/shared/types";
import { searchTarget, type SearchTarget } from "../legacy-discovery";
import { normalize } from "./common";
import type { ProviderSearchInput,SearchJobProvider } from "./types";
export class AdzunaProvider implements SearchJobProvider {
  readonly name='adzuna' as const;
  isConfigured() {return Boolean(process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim());}
  async search(target:SearchTarget,signal:AbortSignal):Promise<NormalizedJob[]> {return importTarget(target,signal);}
}
export class JSearchProvider implements SearchJobProvider {
  readonly name='jsearch' as const;
  isConfigured() {return Boolean(process.env.OPENWEBNINJA_API_KEY?.trim());}
  async search(target:SearchTarget,signal:AbortSignal):Promise<NormalizedJob[]> {return importTarget(target,signal);}
}
async function importTarget(target:SearchTarget,signal:AbortSignal) {
  const source=target.board==='adzuna'?'adzuna':'jsearch';
  const input:ProviderSearchInput={source:{provider:source,companyIdentifier:target.board,careerUrl:source==='adzuna'?'https://adzuna.com':'https://openwebninja.com',discoveryMethod:source},signal,titles:[target.title]};
  return (await searchTarget(target,signal)).map(j=>normalize(input,{id:j.id,title:j.title,company:j.company.display_name,description:j.description,location:j.location.display_name,url:j.redirect_url,apply:j.apply_url,published:j.published,employment:j.contract_type,salary:j.salary})).filter(j=>j!==null).map(j=>({...j,sourceBoard:target.board}));
}
