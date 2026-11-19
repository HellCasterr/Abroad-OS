import {NextResponse} from 'next/server';
import {requireUser,adminClient} from '@/lib/supabase/server';
import {failure} from '@/lib/http';
export async function GET(){try{const {user}=await requireUser();if(!process.env.OWNER_EMAIL||user.email?.toLowerCase()!==process.env.OWNER_EMAIL.toLowerCase())throw new Error('FORBIDDEN');const {data,error}=await adminClient().from('job_runs').select('*').order('started_at',{ascending:false}).limit(20);if(error)throw error;return NextResponse.json({runs:data});}catch(e){return failure(e);}}
