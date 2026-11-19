import {NextResponse} from 'next/server';
import {Webhook} from 'svix';
import {adminClient} from '@/lib/supabase/server';
export async function POST(request:Request){try{
  if(!process.env.RESEND_WEBHOOK_SECRET)return NextResponse.json({error:'Webhook not configured'},{status:503});
  const payload=await request.text();const h={id:request.headers.get('svix-id')||'',timestamp:request.headers.get('svix-timestamp')||'',signature:request.headers.get('svix-signature')||''};
  const event=new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(payload,{'svix-id':h.id,'svix-timestamp':h.timestamp,'svix-signature':h.signature}) as {type:string;data:{email_id:string}};
  const status=event.type==='email.delivered'?'delivered':event.type==='email.bounced'?'failed':event.type==='email.complained'?'failed':null;
  if(status){const {error}=await adminClient().from('notification_deliveries').update({status,updated_at:new Date().toISOString(),error:status==='failed'?event.type:null}).eq('provider_id',event.data.email_id);if(error)throw error;}
  return NextResponse.json({ok:true});
}catch{return NextResponse.json({error:'Invalid webhook'},{status:400});}}
