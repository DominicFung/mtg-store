'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import FacePreviews from '../../../components/facePreviews';
import LidSummary from '../../../components/lidSummary';
import AdminSignInCard from '../../signInCard';
import {
  adminConfigured,
  adminSignOut,
  adminToken,
  advanceShopOrder,
  loadOrder,
  refreshShopDownload,
  undoShopOrder,
  uploadDeliveryPhoto,
  type ShopOrder,
} from '../../../lib/shopOrders';

const PRINT_FILES = [
  'left.stl',
  'spine.stl',
  'right.stl',
  'left-details.txt',
  'spine-details.txt',
  'right-details.txt',
  'filament-layers.json',
  'box-body.stl',
  'lid-base.stl',
  'lid-spark.stl',
  'lid-colours.txt',
  'lid-text.stl (when the lid has a name)',
];

export default function AdminOrderPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params.orderId;
  const [signedIn, setSignedIn] = useState(false);
  const [preview, setPreview] = useState(false);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (adminToken()) setSignedIn(true);
    else if (!adminConfigured()) setPreview(true);
  }, []);

  useEffect(() => {
    if (!(signedIn || preview) || !orderId) return;
    let cancelled = false;
    loadOrder(orderId).then(async (found) => {
      if (cancelled) return;
      if (!found) {
        setError('Order not found.');
        return;
      }
      setOrder(found);
      const url = await refreshShopDownload(orderId);
      if (!cancelled && url) setDownloadUrl(url);
    }).catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load the order');
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, preview, orderId]);

  const reload = async () => {
    if (!orderId) return;
    const found = await loadOrder(orderId);
    setOrder(found);
  };

  const step = async (direction: 'next' | 'previous') => {
    if (!orderId) return;
    setError('');
    try {
      if (direction === 'next') await advanceShopOrder(orderId);
      else await undoShopOrder(orderId);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not change the status');
    }
  };

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const photo = await compressPhoto(file);
      setPhotoBlob(photo);
      setPhotoPreview(URL.createObjectURL(photo));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read the door photo');
    }
  };

  const deliver = async () => {
    if (!photoBlob || !orderId) return;
    setBusy(true);
    setError('');
    try {
      await uploadDeliveryPhoto(orderId, photoBlob, 'image/jpeg');
      setPhotoPreview('');
      setPhotoBlob(null);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the door photo');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!orderId) return;
    setBusy(true);
    setError('');
    try {
      const url = await refreshShopDownload(orderId);
      if (!url) {
        setError('Print files are not ready yet. They stay in the private bucket once the generator finishes.');
        return;
      }
      setDownloadUrl(url);
      window.location.assign(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create a download link');
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn && !preview) {
    return (
      <AdminSignInCard
        intro="Sign in with the admin account. Print files are not available to customers."
        onSignedIn={() => setSignedIn(true)}
        onPreview={() => setPreview(true)}
      />
    );
  }

  const settings = order?.profileSnapshotJson ? prettyJson(order.profileSnapshotJson) : '';

  return (
    <main className="min-h-full bg-[#12182c] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm text-[#e2c275] underline">All orders</Link>
          <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { adminSignOut(); setSignedIn(false); setOrder(null); }}>Sign out</button>
        </div>
        {error && <p className="text-sm text-amber-200">{error}</p>}
        {order && (
          <article className="space-y-4 rounded-xl border border-white/10 p-4">
            <h1 className="font-mono text-2xl text-[#e2c275]">{order.orderNumber}</h1>
            <p>{order.name} · {order.email}</p>
            <p>{fulfillmentLabel(order.status, order.paymentStatus)} · {order.paymentStatus === 'PAID' ? 'Paid' : 'Not paid'}</p>
            <div className="flex flex-wrap gap-2">
              {order.status === 'SHIPPED' && !photoPreview && (
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black">
                  Take door photo
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { void onPhoto(event.target.files?.[0]); }} />
                </label>
              )}
              {photoPreview && (
                <button type="button" className="min-h-11 rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black" disabled={busy} onClick={() => { void deliver(); }}>Mark delivered</button>
              )}
              {photoPreview && (
                <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { setPhotoPreview(''); setPhotoBlob(null); }}>Retake</button>
              )}
              {advanceLabel(order.status) && !confirming && (
                <button type="button" className="min-h-11 rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black" onClick={() => setConfirming(true)}>{advanceLabel(order.status)}</button>
              )}
              {confirming && (
                <button type="button" className="min-h-11 rounded-md bg-[#e2c275] px-3 text-sm font-semibold text-black" onClick={() => { setConfirming(false); void step('next'); }}>Confirm</button>
              )}
              {confirming && (
                <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => setConfirming(false)}>Cancel</button>
              )}
              {order.status !== 'RECEIVED' && order.status !== 'GENERATING_FILES' && order.status !== 'CANCELLED' && (
                <button type="button" className="min-h-11 rounded-md border border-white/20 px-3 text-sm" onClick={() => { void step('previous'); }}>Undo</button>
              )}
            </div>
            {photoPreview && <img src={photoPreview} alt="Door photo, ready to save" className="aspect-[4/5] w-full max-w-xs rounded object-cover" />}
            {order.deliveryPhotoUrl && (
              <div className="relative aspect-[4/5] w-full max-w-xs overflow-hidden rounded">
                <img src={order.deliveryPhotoUrl} alt="The box at the door" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            <p>Price {order.priceLabel}</p>
            <p className="text-sm text-gray-300">{[order.addressLine1, order.city, order.region, order.postalCode, order.country].filter(Boolean).join(', ')}</p>
            {order.lid && <LidSummary lid={order.lid} />}
            {order.previews?.some(Boolean) && <FacePreviews urls={order.previews} />}
            <section>
              <h2 className="text-sm font-semibold text-[#e2c275]">Print settings</h2>
              <p className="mt-1 text-sm">{order.profileName} · {order.nozzleSize} mm nozzle · {order.layerCount} colour layers</p>
              {settings && (
                <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-gray-200">{settings}</pre>
              )}
            </section>
            {order.stops.length > 0 && (
              <ol className="space-y-1 text-sm">
                {order.stops.map((stop) => (
                  <li key={`${stop.filamentId}-${stop.endLayer}`}>{stop.name} through layer {stop.endLayer}</li>
                ))}
              </ol>
            )}
            <section>
              <h2 className="text-sm font-semibold text-[#e2c275]">Print files</h2>
              <p className="mt-1 text-xs text-gray-400">They stay in the private order bucket and are not deleted. A download link is created only for this signed-in session and expires in a few hours.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {PRINT_FILES.filter((name) => name !== 'lid-text.stl (when the lid has a name)' || order.lid?.text).map((name) => <li key={name}>{name}</li>)}
              </ul>
              <button type="button" onClick={() => { void download(); }} disabled={busy} className="mt-3 min-h-11 rounded-md bg-[#e2c275] px-4 text-sm font-semibold text-black disabled:opacity-50">
                {busy ? 'Preparing download…' : 'Download'}
              </button>
              {downloadUrl && <p className="mt-2 break-all text-xs text-gray-400">A fresh link is ready. It is not emailed and customers cannot request one.</p>}
            </section>
          </article>
        )}
      </div>
    </main>
  );
}

async function compressPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
  return blob ?? file;
}

function fulfillmentLabel(status: string, _paymentStatus: string): string {
  if (status === 'GENERATING_FILES') return 'Generating files';
  if (status === 'READY_TO_PRINT') return 'Ready to print';
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
  return null;
}

function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}
