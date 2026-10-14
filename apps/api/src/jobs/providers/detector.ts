import type { CareerSource } from "./types";
import { validPublicUrl } from "../normalization";
export function detectProvider(value: string): CareerSource | null {
  if (!validPublicUrl(value)) return null;
  const url = new URL(value); const host = url.hostname.toLowerCase();
  if (/(?:^|\.)(linkedin\.com|indeed\.com|stepstone\.[a-z.]+)$/i.test(host)) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  let provider: CareerSource['provider'] = 'company'; let identifier = host;
  if (['boards.greenhouse.io','job-boards.greenhouse.io','jobboards.greenhouse.io','boards.eu.greenhouse.io'].includes(host)) { provider='greenhouse'; identifier=parts[0] ?? ''; }
  else if (['jobs.lever.co','jobs.eu.lever.co'].includes(host)) { provider='lever'; identifier=parts[0] ?? ''; }
  else if (host==='jobs.ashbyhq.com') { provider='ashby'; identifier=parts[0] ?? ''; }
  else if (['careers.smartrecruiters.com','jobs.smartrecruiters.com'].includes(host)) { provider='smartrecruiters'; identifier=parts[0] ?? ''; }
  else if (host==='apply.workable.com') { provider='workable'; identifier=parts[0] ?? ''; if (identifier==='j') return null; }
  else if (host.endsWith('.workable.com') && host!=='www.workable.com') { provider='workable'; identifier=host.split('.')[0]; }
  if (!identifier || (provider !== 'company' && !/^[a-zA-Z0-9_-]{1,150}$/.test(identifier))) return null;
  const careerUrl = provider==='company' ? url.href : `${url.origin}/${identifier}`;
  return { provider, companyIdentifier: identifier, careerUrl, discoveryMethod: provider==='company'?'company_career_page':'ats_direct' };
}
