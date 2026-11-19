import { NextResponse } from 'next/server';

export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
  return NextResponse.json({error:message}, {status});
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_URL;
  if (!origin || !expected || new URL(origin).origin !== new URL(expected).origin) throw new Error('FORBIDDEN');
}
