export type TimelineStage = {
  id: string;
  label: string;
  at?: string;
};

const STAGE_STATUS: Record<string, number> = {
  RECEIVED: 0,
  GENERATING_FILES: 0,
  READY_TO_PRINT: 0,
  FAILED: 0,
  PRINTING: 1,
  READY_TO_SHIP: 2,
  SHIPPED: 3,
  DELIVERED: 4,
};

export const TIMELINE_LABELS = ['Order placed', 'Printing', 'Ready to ship', 'Shipped', 'Delivered'] as const;

export function timelineStageIndex(status: string): number {
  return STAGE_STATUS[status] ?? 0;
}

export function effectiveTimeline(input: {
  status: string;
  paymentStatus?: string;
  createdAt?: string;
  history?: Array<{ status: string; at: string; note?: string }>;
}): { stages: TimelineStage[]; current: number } {
  const current = timelineStageIndex(input.status);
  const latest = new Map<number, string>();
  for (const entry of input.history ?? []) {
    if (/undone/i.test(entry.note ?? '')) continue;
    const stage = STAGE_STATUS[entry.status];
    if (stage === undefined || stage > current) continue;
    latest.set(stage, entry.at);
  }
  if (!latest.has(0) && input.createdAt) latest.set(0, input.createdAt);
  const placed = input.paymentStatus === 'PAID' ? 'Order placed / Paid' : 'Order placed';
  const stages = TIMELINE_LABELS.map((label, index) => ({
    id: label.toLowerCase().replace(/[^a-z]+/g, '-'),
    label: index === 0 ? placed : label,
    at: index <= current ? latest.get(index) : undefined,
  }));
  return { stages, current };
}

export function formatToronto(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
