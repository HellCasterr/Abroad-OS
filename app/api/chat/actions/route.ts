import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser,adminClient} from '@/lib/supabase/server';
import {failure,sameOrigin} from '@/lib/http';

const schema=z.object({action_id:z.uuid(),decision:z.enum(['approve','dismiss'])});
const payloadSchema=z.object({kind:z.enum(['task','note']),title:z.string().min(3).max(300),body:z.string().max(3000),due_at:z.iso.datetime({offset:true}).nullable()});

export async function POST(request:Request){try{
  sameOrigin(request);const {db,user}=await requireUser();const {action_id,decision}=schema.parse(await request.json());const admin=adminClient();
  const {data:action,error:lookupError}=await admin.from('chat_actions').select('id,kind,payload,status,result_id').eq('id',action_id).eq('user_id',user.id).single();
  if(lookupError||!action)throw new Error('Proposed action not found.');
  if(action.status!=='pending')return NextResponse.json({status:action.status,result_id:action.result_id});
  const nextStatus=decision==='dismiss'?'dismissed':'processing';
  const {data:claimed,error:claimError}=await admin.from('chat_actions').update({status:nextStatus}).eq('id',action_id).eq('user_id',user.id).eq('status','pending').select('id').maybeSingle();
  if(claimError)throw claimError;if(!claimed)return NextResponse.json({status:'already_processed'});
  if(decision==='dismiss')return NextResponse.json({status:'dismissed'});
  let saved=false;
  try{
    const payload=payloadSchema.parse(action.payload);if(payload.kind!==action.kind)throw new Error('Action type mismatch.');
    const result=payload.kind==='task'
      ?await db.from('tasks').insert({user_id:user.id,title:payload.title,details:payload.body||null,due_at:payload.due_at&&Date.parse(payload.due_at)>Date.now()?payload.due_at:null}).select('id').single()
      :await db.from('notes').insert({user_id:user.id,body:payload.body}).select('id').single();
    if(result.error||!result.data)throw result.error||new Error('Could not save action.');saved=true;
    const {error:completeError}=await admin.from('chat_actions').update({status:'approved',result_id:result.data.id,approved_at:new Date().toISOString()}).eq('id',action_id).eq('user_id',user.id);
    if(completeError)throw completeError;
    await admin.from('audit_logs').insert({user_id:user.id,action:'chat_action_approved',entity:payload.kind,entity_id:result.data.id,after_data:{chat_action_id:action_id}});
    return NextResponse.json({status:'approved',result_id:result.data.id});
  }catch(error){if(!saved)await admin.from('chat_actions').update({status:'pending'}).eq('id',action_id).eq('user_id',user.id).eq('status','processing');throw error;}
}catch(error){return failure(error);}}
