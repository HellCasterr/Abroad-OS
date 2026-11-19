import {NextResponse} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/lib/supabase/server';
import {sameOrigin,failure} from '@/lib/http';
import {runSource} from '@/lib/monitor';
export const maxDuration=60;
export async function POST(request:Request){try{sameOrigin(request);const {db}=await requireUser();const {source_id}=z.object({source_id:z.uuid()}).parse(await request.json());const {data:s}=await db.from('sources').select('id').eq('id',source_id).single();if(!s)throw new Error('Source not found');return NextResponse.json(await runSource(source_id));}catch(e){return failure(e);}}
