export function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function rawBody(event: { body?: string | null; isBase64Encoded?: boolean }): string {
  if (!event.body) return '';
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64').toString('utf8');
  return event.body;
}
