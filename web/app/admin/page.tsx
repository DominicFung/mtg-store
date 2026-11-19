'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminSignInCard from './signInCard';
import {
  adminSignOut,
  adminToken,
  deactivateProfile,
  advanceShopOrder,
  listShopOrders,
  loadOrder,
  undoShopOrder,
  readProfiles,
  refreshShopDownload,
  retryShopOrder,
  saveProfile,
  shopConfigured,
  updateShopStatus,
  type ShopOrder,
} from '../lib/shopOrders';
import { LAUNCH_PROFILES, resolveProfile, type NozzleProfile, type ResolvedProfile } from '../lib/printGeometry';
import LidSummary from '../components/lidSummary';

const STATUSES = ['', 'RECEIVED', 'GENERATING_FILES', 'READY_TO_PRINT', 'PRINTING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED'];

function fulfillmentLabel(status: string, _paymentStatus: string): string {
  if (status === 'PRINTING') return 'Printing';
  if (status === 'READY_TO_SHIP') return 'Ready to ship';
  if (status === 'SHIPPED') return 'Out for delivery';
  if (status === 'DELIVERED') return 'Delivered';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'FAILED') return 'Needs attention';
  return 'Received';
}

function advanceLabel(status: string): string | null {
  if (status === 'RECEIVED' || status === 'GENERATING_FILES' || status === 'READY_TO_PRINT' || status === 'FAILED') return "I've started printing";
  if (status === 'PRINTING') return 'Ready to ship';
  if (status === 'READY_TO_SHIP') return 'Out for delivery';
  if (status === 'SHIPPED') return 'Delivered';
  return null;
}

function OrderMoves({
  order,
  pending,
  onAsk,
  onDone,
}: {
  order: ShopOrder;
  pending: { id: string; direction: 'next' | 'previous' } | null;
  onAsk: (next: { id: string; direction: 'next' | 'previous' } | null) => void;
  onDone: () => void;
}) {
  const next = advanceLabel(order.status);
  const asked = pending?.id === order.orderId ? pending.direction : null;
  const run = async (direction: 'next' | 'previous') => {
    if (direction === 'next' && order.status === 'SHIPPED') return;
    if (direction === 'next') await advanceShopOrder(order.orderId);
    else await undoShopOrder(order.orderId);
    onDone();
  };
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {order.status === 'SHIPPED' ? (
        <Link href={`/admin/orders/${order.orderId}`} className="inline-flex min-h-11 items-center rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black">Add door photo</Link>
      ) : next && asked !== 'next' && (
        <button type="button" className="min-h-11 rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black" onClick={() => onAsk({ id: order.orderId, direction: 'next' })}>{next}</button>
      )}
      {asked === 'next' && (
        <button type="button" className="min-h-11 rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black" onClick={() => { void run('next'); }}>Confirm</button>
      )}
      {asked && <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => onAsk(null)}>Cancel</button>}
      {order.status !== 'RECEIVED' && order.status !== 'GENERATING_FILES' && order.status !== 'CANCELLED' && (
        <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void run('previous'); }}>Undo</button>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [signedIn, setSignedIn] = useState(false);
  const [preview, setPreview] = useState(false);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [status, setStatus] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [selected, setSelected] = useState<ShopOrder | null>(null);
  const [profiles, setProfiles] = useState<ResolvedProfile[]>(LAUNCH_PROFILES.map(resolveProfile));
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ id: string; direction: 'next' | 'previous' } | null>(null);

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

  if (!signedIn && !preview) {
    return (
      <AdminSignInCard
        intro="Dominic only. The user pool does not allow public sign-up, and every admin mutation checks the admin group."
        onSignedIn={() => setSignedIn(true)}
        onPreview={() => setPreview(true)}
      />
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
        <ul className="mt-4 space-y-2">
          {orders.map((order) => (
            <li key={order.orderId} className="rounded-lg border border-white/10 p-3">
              <Link href={`/admin/orders/${order.orderId}`} className="block">
                <span className="font-mono text-[#e2c275]">{order.orderNumber}</span>
                <span className="mt-1 block text-sm">{order.name}</span>
                <span className="mt-1 block text-xs text-gray-400">{order.createdAt.slice(0, 10)} · {order.paymentStatus === 'PAID' ? 'Paid' : 'Not paid'} · {fulfillmentLabel(order.status, order.paymentStatus)}</span>
              </Link>
              <OrderMoves
                order={order}
                pending={pending}
                onAsk={setPending}
                onDone={() => { setPending(null); void refresh(); }}
              />
            </li>
          ))}
        </ul>
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
                {selected.previews.map((src, index) => src ? <img key={index} src={src} alt="" className="aspect-[4/5] w-full rounded bg-black/40 object-cover" /> : null)}
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
