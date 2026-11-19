import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser,adminClient} from '@/lib/supabase/server';
import {sameOrigin,failure} from '@/lib/http';
import {deadlineInstant} from '@/lib/domain';
export async function POST(request:Request){try{sameOrigin(request);const {db,user}=await requireUser();const {snapshot_id,index}=z.object({snapshot_id:z.uuid(),index:z.number().int().nonnegative()}).parse(await request.json());
  const {data:snapshot}=await db.from('source_snapshots').select('*').eq('id',snapshot_id).single();if(!snapshot)throw new Error('Snapshot not found');
  const {data:source}=await db.from('sources').select('*').eq('id',snapshot.source_id).single();if(!source)throw new Error('Source not found');
  const candidate=snapshot.candidate?.deadlines?.[index];if(!candidate||!snapshot.excerpt?.toLowerCase().includes(candidate.evidence_excerpt?.toLowerCase()))throw new Error('Candidate quote not found in snapshot');
  const {data:existing,error:lookupError}=await db.from('deadlines').select('id').eq('source_id',source.id).eq('kind',candidate.kind).eq('label',candidate.label).eq('date_local',candidate.date_local).eq('status','verified').limit(1).maybeSingle();if(lookupError)throw lookupError;
  if(existing)return NextResponse.json({id:existing.id,status:'verified',already_recorded:true});
  const instant=candidate.time_local?deadlineInstant(candidate):null;
  const {data,error}=await adminClient().from('deadlines').insert({user_id:user.id,source_id:source.id,programme_id:source.programme_id,scholarship_id:source.scholarship_id,kind:candidate.kind,label:candidate.label,date_local:candidate.date_local,time_local:candidate.time_local,timezone:candidate.timezone,instant_utc:instant?.toISOString()??null,status:'verified',evidence_excerpt:candidate.evidence_excerpt,verified_at:new Date().toISOString(),academic_cycle:candidate.academic_cycle}).select('id').single();if(error)throw error;
  await adminClient().from('audit_logs').insert({user_id:user.id,action:'verified_deadline',entity:'deadline',entity_id:data.id,after_data:{source_url:source.url,snapshot_id}});
  return NextResponse.json({id:data.id,status:'verified'});
}catch(e){return failure(e);}}
