type Identity = {
  claims?: Record<string, unknown>;
  groups?: string[] | string | null;
};

function asGroups(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) return parsed.map((entry) => String(entry));
      } catch {
        return trimmed.split(/[,\s]+/).filter(Boolean);
      }
    }
    return trimmed.split(/[,\s]+/).filter(Boolean);
  }
  return [];
}

export function adminGroups(identity: unknown): string[] {
  if (!identity || typeof identity !== 'object') return [];
  const record = identity as Identity;
  const claims = record.claims ?? {};
  return [
    ...asGroups(record.groups),
    ...asGroups(claims['cognito:groups']),
  ];
}

export function isAdmin(identity: unknown): boolean {
  return adminGroups(identity).includes('admin');
}

export function assertAdmin(identity: unknown): void {
  if (!isAdmin(identity)) throw new Error('Admin sign-in is required');
}
