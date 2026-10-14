"use client";

import { useState } from 'react';
import { countryName } from '@jobhunt/shared/countries';
import { CountrySelect } from '../ui/CountrySelect';

export function PreferredLocationPicker({onAdd}: {onAdd:(location:string)=>void}) {
  const [country,setCountry]=useState('');
  const [city,setCity]=useState('');
  return <div className="mb-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
    <CountrySelect id="preferred-country" value={country} onChange={setCountry}/>
    <div className="flex flex-col gap-1.5">
      <label htmlFor="preferred-city" className="text-xs font-medium uppercase tracking-wide text-text-secondary">City (optional)</label>
      <input id="preferred-city" value={city} onChange={event=>setCity(event.target.value)} maxLength={100} placeholder="Any city"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"/>
    </div>
    <button type="button" disabled={!country} onClick={()=>{onAdd(city.trim()?`${city.trim()}, ${countryName(country)}`:countryName(country));setCity('');}}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-accent hover:bg-accent-muted focus-visible:outline-accent disabled:opacity-60">Add location</button>
  </div>;
}
