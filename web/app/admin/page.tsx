'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  adminConfigured,
  adminSignIn,
  adminSignOut,
  adminToken,
  deactivateProfile,
  listShopOrders,
  loadOrder,
  readProfiles,
  refreshShopDownload,
  retryShopOrder,
  saveProfile,
  shopConfigured,
  updateShopStatus,
  type ShopOrder,
} from '../lib/shopOrders';
import { LAUNCH_PROFILES, resolveProfile, type NozzleProfile, type ResolvedProfile } from '../lib/printGeometry';
import { missingShopConfig } from '../lib/publicConfig';
import LidSummary from '../components/lidSummary';

const STATUSES = ['', 'RECEIVED', 'GENERATING_FILES', 'READY_TO_PRINT', 'PRINTING', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED'];

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [preview, setPreview] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [status, setStatus] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [selected, setSelected] = useState<ShopOrder | null>(null);
  const [profiles, setProfiles] = useState<ResolvedProfile[]>(LAUNCH_PROFILES.map(resolveProfile));
  const [message, setMessage] = useState('');

  const refresh = async (nextStatus = status, nextEmail = filterEmail) => {
    const rows = await listShopOrders({ status: nextStatus, email: nextEmail });
    setOrders(rows);
    setProfiles(readProfiles());
  };

  useEffect(() => {
    if (adminToken()) setSignedIn(true);
  }, []);

  useEffect(() => {
    if (signedIn || preview) void refresh();
  }, [signedIn, preview]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    try {
      await adminSignIn(email, password);
      setSignedIn(true);
    } catch (caught) {
      setAuthError(caught instanceof Error ? caught.message : 'Sign-in failed');
    }
  };

  const missingConfig = missingShopConfig();

  if (!signedIn && !preview) {
    return (
      <main className="min-h-full bg-[#12182c] px-4 py-10 text-white">
        <form onSubmit={(event) => { void signIn(event); }} className="mx-auto max-w-md space-y-3 rounded-xl border border-white/10 bg-black/30 p-6">
          <h1 className="text-2xl font-bold text-[#e2c275]">Shop admin</h1>
          <p className="text-sm text-gray-300">Dominic only. The user pool does not allow public sign-up, and every admin mutation checks the admin group.</p>
          {missingConfig.length > 0 && (
            <p className="rounded-md border border-amber-300/40 bg-amber-950/40 p-3 text-sm text-amber-100">
              This build is missing {missingConfig.join(', ')}. Next reads those values when it builds, so set them in Amplify and rebuild. Sign-in stays disabled until then.
            </p>
          )}
          <label className="block text-xs text-gray-400" htmlFor="admin-email">Email
            <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1a1a2e] px-3" />
          </label>
          <label className="block text-xs text-gray-400" htmlFor="admin-password">Password
            <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1a1a2e] px-3" />
          </label>
          {authError && <p className="text-sm text-amber-200">{authError}</p>}
          <button type="submit" className="min-h-11 w-full rounded-md bg-[#e2c275] font-semibold text-black" disabled={!adminConfigured()}>
            Sign in
          </button>
          {!adminConfigured() && (
            <button type="button" className="min-h-11 w-full rounded-md border border-white/20 text-sm" onClick={() => setPreview(true)}>
              Preview orders in this browser
            </button>
          )}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#12182c] px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-[#e2c275]">Orders</h1>
          <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { adminSignOut(); setSignedIn(false); setPreview(false); }}>Sign out</button>
        </div>
        {!shopConfigured() && <p className="mt-2 text-xs text-gray-400">Shop API is not configured. This list is stored in this browser. Deployed admin calls require the Cognito admin group.</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="text-xs text-gray-400" htmlFor="filter-status">Status
            <select id="filter-status" value={status} onChange={(event) => { setStatus(event.target.value); void refresh(event.target.value, filterEmail); }} className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1a1a2e] px-2 sm:w-56">
              {STATUSES.map((entry) => <option key={entry || 'all'} value={entry}>{entry || 'All statuses'}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-400" htmlFor="filter-email">Email
            <input id="filter-email" value={filterEmail} onChange={(event) => setFilterEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#1a1a2e] px-3 sm:w-64" />
          </label>
        </div>
        <ul className="mt-4 space-y-2 md:hidden">
          {orders.map((order) => (
            <li key={order.orderId}>
              <button type="button" onClick={() => { void openOrder(order.orderId); }} className="w-full rounded-lg border border-white/10 p-3 text-left">
                <span className="font-mono text-[#e2c275]">{order.orderNumber}</span>
                <span className="mt-1 block text-sm">{order.name} · {order.status}</span>
              </button>
            </li>
          ))}
        </ul>
        <table className="mt-4 hidden w-full text-left text-sm md:table">
          <thead className="text-gray-400"><tr><th className="py-2">Order</th><th>Customer</th><th>Status</th><th>Nozzle</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderId} className="border-t border-white/10">
                <td className="py-2 font-mono"><button type="button" className="text-[#e2c275]" onClick={() => { void openOrder(order.orderId); }}>{order.orderNumber}</button></td>
                <td>{order.name}<span className="block text-xs text-gray-400">{order.email}</span></td>
                <td>{order.status}</td>
                <td>{order.profileName}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected && (
          <section className="mt-6 rounded-xl border border-white/10 p-4">
            <h2 className="text-lg text-[#e2c275]">{selected.orderNumber}</h2>
            <p className="text-sm">{selected.name} · {selected.status}</p>
            {selected.errorMessage && <p className="mt-2 text-sm text-amber-200">{selected.errorMessage}</p>}
            {selected.lid && (
              <div className="mt-3">
                <LidSummary lid={selected.lid} />
                <p className="mt-2 text-xs text-gray-400">The print bundle names these filaments and includes the shell, the lid, the logo, and the name as separate pieces.</p>
              </div>
            )}
            {selected.previews?.some(Boolean) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {selected.previews.map((src, index) => src ? <img key={index} src={src} alt="" className="w-full rounded" /> : null)}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void change('PRINTING'); }}>Mark printing</button>
              <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void change('SHIPPED', 'Canada Post', 'CP000111222CA'); }}>Mark shipped</button>
              <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void change('DELIVERED'); }}>Mark delivered</button>
              <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void retry(); }}>Retry files</button>
              <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void download(); }}>New download link</button>
            </div>
            {message && <p className="mt-2 text-sm text-gray-300">{message}</p>}
          </section>
        )}
        <ProfileEditor profiles={profiles} onChange={setProfiles} />
      </div>
    </main>
  );

  async function openOrder(orderId: string) {
    const detail = await loadOrder(orderId);
    setSelected(detail);
    setMessage('');
  }

  async function change(next: string, carrier?: string, trackingNumber?: string) {
    if (!selected) return;
    await updateShopStatus(selected.orderId, next, { carrier, trackingNumber, note: `Marked ${next}` });
    await openOrder(selected.orderId);
    await refresh();
  }

  async function retry() {
    if (!selected) return;
    await retryShopOrder(selected.orderId);
    await openOrder(selected.orderId);
    await refresh();
  }

  async function download() {
    if (!selected) return;
    const url = await refreshShopDownload(selected.orderId);
    setMessage(url ? url : 'Download links are created after the generator finishes. This preview has no print file.');
  }
}

function ProfileEditor({ profiles, onChange }: { profiles: ResolvedProfile[]; onChange: (profiles: ResolvedProfile[]) => void }) {
  const [name, setName] = useState('0.6 mm draft');
  return (
    <section className="mt-8 rounded-xl border border-white/10 p-4">
      <h2 className="text-lg text-[#e2c275]">Nozzle profiles</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {profiles.map((profile) => (
          <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2">
            <span>{profile.name} · {profile.nozzleSize} mm · {profile.layerCount} layers · {profile.active ? 'active' : 'inactive'}{profile.isDefault ? ' · default' : ''}</span>
            <button type="button" className="min-h-11 rounded-md border border-white/20 px-3" disabled={profile.isDefault || !profile.active} onClick={() => { void turnOff(profile.id); }}>Deactivate</button>
          </li>
        ))}
      </ul>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <label className="text-xs text-gray-400" htmlFor="profile-name">New profile name
          <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 rounded-md border border-white/15 bg-[#1a1a2e] px-3" />
        </label>
        <button type="submit" className="min-h-11 self-end rounded-md bg-[#e2c275] px-3 font-semibold text-black">Add from the 0.4 mm numbers</button>
      </form>
    </section>
  );

  async function turnOff(id: string) {
    await deactivateProfile(id);
    onChange(readProfiles());
  }

  async function add() {
    const base = LAUNCH_PROFILES[1];
    const profile: NozzleProfile = { ...base, id: `nozzle-${Date.now().toString(36)}`, name, isDefault: false, active: true };
    await saveProfile(profile);
    onChange(readProfiles());
  }
}
