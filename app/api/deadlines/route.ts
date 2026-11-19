import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser,adminClient} from '@/lib/supabase/server';
import {sameOrigin,failure} from '@/lib/http';
import {deadlineInstant,isOfficialUrl} from '@/lib/domain';

const schema=z.object({label:z.string().min(3).max(200),kind:z.enum(['admission','scholarship','reference','language','fee','uni_assist','interview','deposit','result','visa','housing','other']),date_local:z.iso.date(),time_local:z.string().regex(/^\d\d:\d\d$/).nullable(),timezone:z.string().min(3).nullable(),programme_id:z.uuid().optional(),scholarship_id:z.uuid().optional(),source_id:z.uuid().optional(),evidence_excerpt:z.string().max(1000).nullable().optional()}).refine(x=>Boolean(x.programme_id)!==Boolean(x.scholarship_id),'Choose one programme or scholarship').refine(x=>Boolean(x.time_local)===Boolean(x.timezone),'Time and timezone must be supplied together');

export async function POST(request:Request){try{sameOrigin(request);const {db,user}=await requireUser();const input=schema.parse(await request.json());
  const {data:parent}=input.programme_id?await db.from('programmes').select('id').eq('id',input.programme_id).single():await db.from('scholarships').select('id').eq('id',input.scholarship_id!).single();if(!parent)throw new Error('Programme or scholarship not found');
  if(input.source_id){const {data:s}=await db.from('sources').select('url').eq('id',input.source_id).single();if(!s||!isOfficialUrl(s.url))throw new Error('Official source required');}
  let instant:Date|null=null;if(input.time_local){try{instant=deadlineInstant(input as Parameters<typeof deadlineInstant>[0]);}catch{throw new Error('Invalid IANA timezone');}}
  const {data,error}=await adminClient().from('deadlines').insert({...input,user_id:user.id,instant_utc:instant?.toISOString()??null,status:'needs_review'}).select('id').single();if(error)throw error;
  return NextResponse.json({id:data.id,status:'needs_review'});
}catch(e){return failure(e);}}
