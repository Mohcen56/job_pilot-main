import { COUNTRY_DATA } from './country-data';
const turkish = new Intl.DisplayNames(['tr'], { type: 'region' });
export const COUNTRIES = COUNTRY_DATA;
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const names = new Map<string,string>();
for (const {code,name} of COUNTRIES) {
  for (const label of [code, name, turkish.of(code.toUpperCase()) ?? '']) names.set(normalize(label), code);
}
for (const [label,code] of Object.entries({ turkey:'tr', turkiye:'tr', uk:'gb', usa:'us', 'united states of america':'us', 'south korea':'kr', 'north korea':'kp', russia:'ru', 'czech republic':'cz', vietnam:'vn', taiwan:'tw' })) names.set(label,code);
const cities: Record<string,string> = { london:'gb', berlin:'de', paris:'fr', istanbul:'tr', ankara:'tr', izmir:'tr', toronto:'ca', sydney:'au', amsterdam:'nl', dubai:'ae' };
export function countryForLocation(location: string, fallback = ''): string {
  const parts = normalize(location).split(',').map(value => value.trim());
  return names.get(parts.at(-1) ?? '') ?? names.get(normalize(location)) ?? cities[normalize(location)] ?? fallback;
}
export function isCountryLocation(location: string): boolean { return names.has(normalize(location)); }
export function countryName(code: string): string { return COUNTRIES.find(country => country.code === code)?.name ?? code; }
