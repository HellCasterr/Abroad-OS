import {NextResponse} from 'next/server';
import {requireUser,adminClient} from '@/lib/supabase/server';
import {googleReady} from '@/lib/calendar';
import {failure} from '@/lib/http';
export async function GET(){try{const {user}=await requireUser();const {data}=await adminClient().from('calendar_connections').select('connected_at').eq('user_id',user.id).maybeSingle();return NextResponse.json({connected:Boolean(data),configured:googleReady()});}catch(e){return failure(e);}}
