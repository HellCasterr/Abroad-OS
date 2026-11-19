import { afterEach, describe, expect, it } from 'vitest';
import { sameOrigin } from '../lib/http';

const previousAppUrl = process.env.APP_URL;
afterEach(() => { process.env.APP_URL = previousAppUrl; });

describe('sameOrigin', () => {
  it('accepts the actual deployment host even when APP_URL points to a different alias', () => {
    process.env.APP_URL = 'https://primary.example.com';
    const request = new Request('https://preview.example.com/api/bootstrap', {
      method: 'POST', headers: { origin: 'https://preview.example.com', host: 'preview.example.com' }
    });
    expect(() => sameOrigin(request)).not.toThrow();
  });

  it('allows local development', () => {
    const request = new Request('http://localhost:3000/api/bootstrap', {
      method: 'POST', headers: { origin: 'http://localhost:3000', host: 'localhost:3000' }
    });
    expect(() => sameOrigin(request)).not.toThrow();
  });

  it('honours the public protocol when behind a proxy', () => {
    const request = new Request('http://internal/api/bootstrap', {
      method: 'POST', headers: { origin: 'https://preview.example.com', host: 'preview.example.com', 'x-forwarded-proto': 'https' }
    });
    expect(() => sameOrigin(request)).not.toThrow();
  });

  it('rejects a different host, protocol, or missing Origin', () => {
    for (const origin of ['https://evil.example.com', 'http://preview.example.com', null]) {
      const headers: Record<string, string> = { host: 'preview.example.com' };
      if (origin) headers.origin = origin;
      const request = new Request('https://preview.example.com/api/bootstrap', { method: 'POST', headers });
      expect(() => sameOrigin(request)).toThrow('FORBIDDEN');
    }
  });
});
