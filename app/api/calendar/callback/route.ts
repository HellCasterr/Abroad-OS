import {NextRequest,NextResponse} from 'next/server';
import {requireUser,adminClient} from '@/lib/supabase/server';
import {encrypt,googleReady} from '@/lib/calendar';
export async function GET(request:NextRequest){const response=NextResponse.redirect(`${process.env.APP_URL}/settings`);response.cookies.delete('calendar_oauth_state');try{
  if(!googleReady())throw new Error('Not configured');const state=request.nextUrl.searchParams.get('state');const code=request.nextUrl.searchParams.get('code');if(!state||state!==request.cookies.get('calendar_oauth_state')?.value||!code)throw new Error('Invalid OAuth state');const {db,user}=await requireUser();
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:`${process.env.APP_URL}/api/calendar/callback`,grant_type:'authorization_code'})});const token=await r.json();if(!r.ok||!token.refresh_token)throw new Error('Refresh token unavailable');
  const {error}=await adminClient().from('calendar_connections').upsert({user_id:user.id,encrypted_refresh_token:encrypt(token.refresh_token),connected_at:new Date().toISOString()});if(error)throw error;
  return response;
}catch{return NextResponse.redirect(`${process.env.APP_URL}/settings?calendar=error`);}}
