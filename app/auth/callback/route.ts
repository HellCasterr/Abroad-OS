import { NextRequest,NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest){
  const code=new URL(request.url).searchParams.get('code');
  if (code){const db=await serverClient();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL('/today',request.url));}
  return NextResponse.redirect(new URL('/login?error=auth',request.url));
}
