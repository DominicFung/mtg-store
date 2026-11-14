const SCRYFALL_HOSTS = new Set(['cards.scryfall.io', 'api.scryfall.com']);

/** https URL whose host is on the list. Rejects credentials and non-https. */
export function isHttpsHost(value: string, allow: (hostname: string) => boolean): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  return allow(url.hostname.toLowerCase());
}

export function isScryfallHost(hostname: string): boolean {
  return SCRYFALL_HOSTS.has(hostname.toLowerCase());
}

/** Virtual-hosted and path-style S3 URLs, including regional endpoints. */
export function isS3Host(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return /^(.+\.)?s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host);
}

export function isScryfallArtUrl(value: string): boolean {
  return isHttpsHost(value, isScryfallHost);
}

/** Scryfall art or the private order bucket. Used when proxying bytes same-origin. */
export function isFetchableArtUrl(value: string): boolean {
  return isHttpsHost(value, (host) => isScryfallHost(host) || isS3Host(host));
}
