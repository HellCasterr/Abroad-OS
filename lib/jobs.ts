import {adminClient} from '@/lib/supabase/server';
import {runSource} from '@/lib/monitor';
import {reminderKey} from '@/lib/domain';
import {nextOccurrence} from '@/lib/recurrence';
import {Resend} from 'resend';

const db=()=>adminClient();
const isoDay=(d:Date)=>d.toISOString().slice(0,10);
const istDay=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const points=[['30d',30*86400000],['14d',14*86400000],['7d',7*86400000],['3d',3*86400000],['1d',86400000],['12h',12*3600000]] as const;

async function queue(userId:string,key:string,subject:string,body:string,sourceUrl?:string){
  await db().from('alerts').upsert({user_id:userId,dedupe_key:key,title:subject,body,source_url:sourceUrl||null},{onConflict:'user_id,dedupe_key',ignoreDuplicates:true});
  const {data:p}=await db().from('profiles').select('email_enabled,notification_email,email').eq('user_id',userId).single();
  if(p?.email_enabled && (p.notification_email||p.email))await db().from('notification_deliveries').upsert({user_id:userId,dedupe_key:key,subject,body,recipient:p.notification_email||p.email},{onConflict:'user_id,dedupe_key',ignoreDuplicates:true});
}

async function deliverPending(){
  const {data:items,error}=await db().from('notification_deliveries').select('*').in('status',['queued','failed']).lte('next_attempt_at',new Date().toISOString()).order('created_at').limit(15);if(error)throw error;
  if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return {sent:0,unconnected:true};
  const provider=new Resend(process.env.RESEND_API_KEY);let sent=0;
  for(const item of items??[]){try{
    const {data,error:e}=await provider.emails.send({from:process.env.RESEND_FROM_EMAIL,to:item.recipient,subject:item.subject,text:item.body,headers:{'X-AbroadOS-Delivery':item.id}});if(e)throw new Error(e.message);
    await db().from('notification_deliveries').update({status:'provider_accepted',provider_id:data?.id,attempts:item.attempts+1,error:null,updated_at:new Date().toISOString()}).eq('id',item.id);sent++;
  }catch(e){await db().from('notification_deliveries').update({status:'failed',attempts:item.attempts+1,error:e instanceof Error?e.message:'Provider error',next_attempt_at:new Date(Date.now()+Math.min(86400000,2**item.attempts*3600000)).toISOString(),updated_at:new Date().toISOString()}).eq('id',item.id);}}
  return {sent,unconnected:false};
}

async function scanSources(near=false){
  let query=db().from('sources').select('id,user_id,url,programme_id,scholarship_id').eq('monitor_enabled',true).or(`next_check_at.is.null,next_check_at.lte.${new Date().toISOString()}`).limit(10);
  if(near){const {data:soon}=await db().from('deadlines').select('programme_id,scholarship_id').eq('status','verified').gte('date_local',isoDay(new Date())).lte('date_local',isoDay(new Date(Date.now()+14*86400000)));const programmes=new Set((soon??[]).map(x=>x.programme_id));const funds=new Set((soon??[]).map(x=>x.scholarship_id));const {data:all}=await db().from('sources').select('id,user_id,url,programme_id,scholarship_id').eq('monitor_enabled',true).limit(100);const selected=(all??[]).filter(x=>programmes.has(x.programme_id)||funds.has(x.scholarship_id)).slice(0,10);return processSources(selected);}
  const {data,error}=await query;if(error)throw error;return processSources(data??[]);
}
async function processSources(sources:Array<{id:string;user_id:string;url:string}>){let checked=0,changes=0,errors:string[]=[];
  for(const s of sources){try{const result=await runSource(s.id);checked++;if(result.changed){changes++;await queue(s.user_id,`source-alert:${s.id}:${new Date().toISOString().slice(0,10)}`,'Official source changed',`Review the new source snapshot for possible changes to deadlines or funding: ${s.url}`,s.url);}}catch(e){errors.push(`${s.url}: ${e instanceof Error?e.message:'unavailable'}`);}}
  return {checked,changes,errors};
}

async function reminders(){
  const {data:deadlines,error}=await db().from('deadlines').select('id,user_id,label,date_local,instant_utc,time_local,kind,source_id,programme_id,scholarship_id').eq('status','verified').gte('date_local',isoDay(new Date())).lte('date_local',isoDay(new Date(Date.now()+31*86400000)));if(error)throw error;
  let alerts=0;const now=Date.now();
  for(const d of deadlines??[]){
    for(const [label,ms] of points){if(!d.instant_utc && label==='12h')continue;
      const target=d.instant_utc?new Date(d.instant_utc).getTime()-ms:new Date(`${d.date_local}T00:00:00+05:30`).getTime()-ms;
      const window=d.instant_utc?15*3600000:24*3600000;
      if(now>=target&&now<target+window){const key=reminderKey(d.id,label);await queue(d.user_id,key,`${label} remaining: ${d.label}`,`${d.label} is scheduled for ${d.date_local}${d.time_local?' at '+d.time_local:' (closing time not published)'}. Verify the official source in AbroadOS before acting.`);alerts++;}
    }
  }
  const {data:overdue}=await db().from('tasks').select('id,due_at,recurrence').eq('status','open').not('recurrence','is',null).lt('due_at',new Date().toISOString()).limit(100);
  for(const t of overdue??[]){const next=nextOccurrence(new Date(t.due_at),t.recurrence);if(next)await db().from('tasks').update({due_at:next.toISOString()}).eq('id',t.id);}
  const {data:tasks}=await db().from('tasks').select('id,user_id,title,due_at').eq('status','open').gte('due_at',new Date().toISOString()).lte('due_at',new Date(Date.now()+86400000).toISOString());
  for(const t of tasks??[]){await queue(t.user_id,`task:${t.id}:${istDay(new Date())}`,`Task due: ${t.title}`,`Your task is due ${t.due_at}. Open AbroadOS to review it.`);alerts++;}
  const mail=await deliverPending();return {checked:(deadlines??[]).length,changes:alerts,errors:mail.unconnected?['Resend not connected; in-app alerts remain available']:[]};
}

async function weekly(){const {data:profiles,error}=await db().from('profiles').select('user_id,email_enabled,notification_email,email').eq('email_enabled',true);if(error)throw error;let count=0;
  for(const p of profiles??[]){const {data:tasks}=await db().from('tasks').select('title').eq('user_id',p.user_id).eq('status','open').limit(8);const {data:apps}=await db().from('applications').select('status').eq('user_id',p.user_id);const {data:deadlines}=await db().from('deadlines').select('label,date_local').eq('user_id',p.user_id).eq('status','verified').gte('date_local',isoDay(new Date())).lte('date_local',isoDay(new Date(Date.now()+7*86400000))).limit(10);
    await queue(p.user_id,`weekly:${istDay(new Date())}`,'AbroadOS weekly admissions digest',`Applications submitted: ${(apps??[]).filter(x=>x.status==='submitted').length}.\nThis week's verified deadlines:\n${(deadlines??[]).map(x=>`- ${x.date_local}: ${x.label}`).join('\n')||'None'}\nOpen tasks:\n${(tasks??[]).map(x=>`- ${x.title}`).join('\n')||'None'}\nReview official evidence in your dashboard.`);count++;}
  const mail=await deliverPending();return {checked:count,changes:0,errors:mail.unconnected?['Resend not connected']:[]};}

export async function runJob(type:'monitor'|'near'|'reminders'|'weekly'){
  const key=`${type}:${istDay(new Date())}`;const client=db();const {data:existing}=await client.from('job_runs').select('*').eq('job_key',key).maybeSingle();
  if(existing?.status==='completed')return {skipped:true,key};if(existing?.status==='running'&&Date.now()-new Date(existing.started_at).getTime()<20*60000)return {skipped:true,key};
  const run=existing?await client.from('job_runs').update({status:'running',started_at:new Date().toISOString(),attempts:existing.attempts+1,error:null}).eq('id',existing.id):await client.from('job_runs').insert({job_key:key,job_type:type});if(run.error)throw run.error;
  try{const result=type==='monitor'?await scanSources():type==='near'?await scanSources(true):type==='weekly'?await weekly():await reminders();
    await client.from('job_runs').update({status:result.errors.length?'partial':'completed',finished_at:new Date().toISOString(),items_checked:result.checked,changes_found:result.changes,error:result.errors.join('\n')||null}).eq('job_key',key);
    return {key,...result};
  }catch(e){await client.from('job_runs').update({status:'failed',finished_at:new Date().toISOString(),error:e instanceof Error?e.message:'Unknown failure'}).eq('job_key',key);throw e;}
}
