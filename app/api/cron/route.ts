import {NextRequest,NextResponse} from 'next/server';
import {runJob} from '@/lib/jobs';
export const maxDuration=300;
export async function GET(request:NextRequest){
  if(!process.env.CRON_SECRET||request.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Unauthorized'},{status:401});
  const job=request.nextUrl.searchParams.get('job');if(!['monitor','near','reminders','weekly'].includes(job??''))return NextResponse.json({error:'Invalid job'},{status:400});
  try{return NextResponse.json(await runJob(job as 'monitor'|'near'|'reminders'|'weekly'));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Job failed'},{status:500});}
}
