'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOX_PRICE_LABEL } from '../../../packages/print-core/src/orderNumber';
import { checkDelivery } from '../../../packages/print-core/src/deliveryArea';
import type { Filament } from '../lib/filamentCatalogue';
import type { ResolvedProfile } from '../lib/printGeometry';
import LidSummary from '../components/lidSummary';
import { cardPaymentsReady } from '../lib/publicConfig';
import { lidFromChoice, placeOrder, shopConfigured, startCardPayment, type LidChoice } from '../lib/shopOrders';

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
  artSource: 'example' | 'upload' | 'scryfall';
};

const FACES = ['Right', 'Spine', 'Left'];

export default function OrderPanel({ crops, previews, layers, stops, profile, profiles, onProfile, faceSizes, lid, artSource }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('Ontario');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Canada');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const paymentsOn = cardPaymentsReady();
  const delivery = useMemo(
    () => checkDelivery({ city, region, postalCode, country }),
    [city, region, postalCode, country],
  );
  const identityReady = name.trim().length > 0 && email.includes('@') && addressLine1.trim().length > 0;
  const canPay = paymentsOn && delivery.ok && identityReady && Boolean(crops[0]) && !submitting;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canPay) return;
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
        artSource,
      });
      const url = await startCardPayment(order);
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not start the payment');
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
          We print the box and deliver it in person around Toronto, Mississauga, Milton, and Etobicoke.
          You get a receipt and a tracking page. Print files stay with the shop.
          {' '}
          {shopConfigured() ? 'This order is sent to the shop after you pay.' : 'The shop API is not configured, so a paid order cannot be sent yet.'}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field id="order-name" label="Name" value={name} onChange={setName} required />
          <Field id="order-email" label="Email" type="email" value={email} onChange={setEmail} required />
          <Field id="order-address" label="Address" value={addressLine1} onChange={setAddressLine1} className="sm:col-span-2" required />
          <Field id="order-city" label="City" value={city} onChange={setCity} required />
          <Field id="order-region" label="Province" value={region} onChange={setRegion} required />
          <Field id="order-postal" label="Postal code" value={postalCode} onChange={setPostalCode} required />
          <Field id="order-country" label="Country" value={country} onChange={setCountry} required />
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
          Price <span className="text-[#e2c275]">{BOX_PRICE_LABEL}</span>
          <span className="text-gray-400"> per box, delivered locally.</span>
        </p>
        <p className={`mt-2 text-sm ${delivery.ok ? 'text-emerald-200' : 'text-amber-200'}`} role="status">
          {delivery.message}
        </p>
        {!paymentsOn && (
          <p className="mt-2 text-sm text-[#e2c275]">Online payment coming soon. We can still check that we deliver to your address. The pay button stays off until card payment is switched on.</p>
        )}
      </div>
      {error && <p className="text-sm text-amber-200">{error}</p>}
      <button
        type="submit"
        disabled={!canPay}
        className="min-h-11 w-full rounded-md bg-[#e2c275] px-4 text-sm font-semibold text-black disabled:bg-gray-500 disabled:text-gray-200 sm:w-auto"
      >
        {submitting ? 'Starting payment…' : paymentsOn ? `Pay ${BOX_PRICE_LABEL}` : 'Online payment coming soon'}
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
        autoComplete={id === 'order-postal' ? 'postal-code' : id === 'order-city' ? 'address-level2' : 'on'}
        className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-sm text-white"
      />
    </label>
  );
}
