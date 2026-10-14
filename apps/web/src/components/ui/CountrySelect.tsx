"use client";

import { COUNTRIES } from '@jobhunt/shared/countries';

export function CountrySelect({ id, value, onChange, disabled = false }: {
  id: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  return <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-text-secondary">Country</label>
    <select id={id} value={value} onChange={event=>onChange(event.target.value)} disabled={disabled}
      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60">
      <option value="">Select country</option>
      {COUNTRIES.map(country=><option key={country.code} value={country.code}>{country.name}</option>)}
    </select>
  </div>;
}
