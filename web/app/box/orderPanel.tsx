'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Filament } from '../lib/filamentCatalogue';
import type { ResolvedProfile } from '../lib/printGeometry';
import LidSummary from '../components/lidSummary';
import { lidFromChoice, placeOrder, shopConfigured, type LidChoice } from '../lib/shopOrders';

type Props = {
  crops: [string, string, string];
  previews: [string, string, string];
  layers: Filament[];
  stops: number[];
  profile: ResolvedProfile;
  profiles: ResolvedProfile[];
  onProfile: (id: string) => void;
  faceSizes: Array<{ widthMm: number; heightMm: number } | null>;
  lid: LidChoice | null;
};

const FACES = ['Left', 'Spine', 'Right'];

export default function OrderPanel({ crops, previews, layers, stops, profile, profiles, onProfile, faceSizes, lid }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const order = await placeOrder({
        name,
        email,
        addressLine1,
        city,
        region,
        postalCode,
        country,
        note,
        profile,
        layers,
        stops,
        crops,
        previews: previews[0] ? previews : crops,
        lid: lid ?? undefined,
      });
      const params = new URLSearchParams({ order: order.orderNumber, email: order.email });
      router.push(`/receipt?${params.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not place the order');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => { void submit(event); }} className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div>
        <h2 className="text-sm font-semibold text-[#e2c275]">Nozzle</h2>
        <label className="mt-2 block text-xs text-gray-400" htmlFor="nozzle-profile">Profile</label>
        <select
          id="nozzle-profile"
          value={profile.id}
          onChange={(event) => onProfile(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-sm"
        >
          {profiles.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {entry.layerCount} colour layers{entry.isDefault ? ' · default' : ''}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-gray-400">
          {profile.nozzleSize} mm nozzle, {profile.layerHeight} mm layers, detail {profile.detailSize} mm.
          Colour core {profile.layerCount} layers (max depth is layer {profile.layersAtMaxDepth}).
          {profile.brightnessAdjust ? ` Brightness adjust ${profile.brightnessAdjust}.` : ''}
        </p>
        {faceSizes.some(Boolean) && (
          <ul className="mt-2 space-y-1 text-sm">
            {faceSizes.map((size, index) => (
              <li key={FACES[index]}>
                {FACES[index]}
                {size ? ` ${size.widthMm.toFixed(2)} × ${size.heightMm.toFixed(2)} mm` : ' — waiting for the crop'}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[#e2c275]">Order</h2>
        {lid && <div className="mt-3"><LidSummary lid={lidFromChoice(lid)} /></div>}
        <p className="mt-1 text-xs text-gray-400">
          We print the box. You get a receipt and a tracking page. Print files stay with the shop.
          {' '}
          {shopConfigured() ? 'This order is sent to the shop.' : 'The shop API is not configured, so this order stays in this browser.'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field id="order-name" label="Name" value={name} onChange={setName} required />
          <Field id="order-email" label="Email" type="email" value={email} onChange={setEmail} required />
          <Field id="order-address" label="Address" value={addressLine1} onChange={setAddressLine1} className="sm:col-span-2" />
          <Field id="order-city" label="City" value={city} onChange={setCity} />
          <Field id="order-region" label="Region" value={region} onChange={setRegion} />
          <Field id="order-postal" label="Postal code" value={postalCode} onChange={setPostalCode} />
          <Field id="order-country" label="Country" value={country} onChange={setCountry} />
        </div>
        <label className="mt-3 block text-xs text-gray-400" htmlFor="order-note">Note</label>
        <textarea
          id="order-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-white/15 bg-[#12182c] px-3 py-2 text-sm"
        />
        <p className="mt-3 text-sm">
          Price <span className="text-[#e2c275]">{'Price confirmed before printing'}</span>
        </p>
        <p className="text-xs text-gray-500">Payment is not collected here yet.</p>
      </div>
      {error && <p className="text-sm text-amber-200">{error}</p>}
      <button
        type="submit"
        disabled={!crops[0] || submitting}
        className="min-h-11 w-full rounded-md bg-[#e2c275] px-4 text-sm font-semibold text-black disabled:bg-gray-500 disabled:text-gray-200 sm:w-auto"
      >
        {submitting ? 'Placing order…' : 'Place order'}
      </button>
    </form>
  );
}

function Field({ id, label, value, onChange, type = 'text', required = false, className = '' }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block text-xs text-gray-400 ${className}`} htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-sm text-white"
      />
    </label>
  );
}
