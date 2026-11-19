import { NextResponse } from 'next/server';

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
  return NextResponse.json({error:message}, {status});
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) throw new Error('FORBIDDEN');
  try {
    const source = new URL(origin);
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
    if (!['http:', 'https:'].includes(source.protocol) || source.host.toLowerCase() !== host.toLowerCase() || source.protocol !== `${protocol}:`)
      throw new Error('FORBIDDEN');
  } catch {
    throw new Error('FORBIDDEN');
  }
}
