import crypto from 'node:crypto';

export interface SignInput {
  timestamp: string;
  method: string;
  pathWithQuery: string;
  body?: string;
  sharedSecret: string;
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function buildCanonicalPayload(input: Omit<SignInput, 'sharedSecret'>): string {
  return [input.timestamp, input.method.toUpperCase(), input.pathWithQuery, sha256Hex(input.body ?? '')].join('\n');
}

export function signCanonicalPayload(canonicalPayload: string, sharedSecret: string): string {
  return crypto.createHmac('sha256', sharedSecret).update(canonicalPayload, 'utf8').digest('hex');
}

export function signRequest(input: SignInput): { timestamp: string; signature: string; signatureHeader: string } {
  const signature = signCanonicalPayload(buildCanonicalPayload(input), input.sharedSecret);
  return { timestamp: input.timestamp, signature, signatureHeader: `sha256=${signature}` };
}

export function verifySignatureHeader(
  input: Omit<SignInput, 'sharedSecret'> & { sharedSecret: string; signatureHeader: string },
): boolean {
  const expected = signCanonicalPayload(buildCanonicalPayload(input), input.sharedSecret);
  const provided = input.signatureHeader.replace(/^sha256=/i, '').trim();
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(provided, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export function pathWithQueryFromUrl(fullUrl: string): string {
  const u = new URL(fullUrl);
  return `${u.pathname}${u.search}`;
}
