import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/supabase/server';
import {googleReady} from '@/lib/calendar';
import {failure} from '@/lib/http';

export async function GET(){
  try{
    await requireUser();
    return NextResponse.json({
      openai:Boolean(process.env.OPENAI_API_KEY),
      email:Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_FROM_EMAIL),
      scheduler:Boolean(process.env.CRON_SECRET),
      google:googleReady()
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return failure(error);}
}
