export type Deadline = {date_local:string; time_local:string|null; timezone:string|null; verified_at:string|null; source_url:string|null; status:string; kind:string};

export function deadlineInstant(d: Pick<Deadline,'date_local'|'time_local'|'timezone'>): Date|null {
  if (!d.time_local || !d.timezone) return null;
  // Iterate to resolve the named time zone offset at the actual date, including DST.
  const [y,m,day] = d.date_local.split('-').map(Number);
  const [h,min] = d.time_local.split(':').map(Number);
  let guess = Date.UTC(y,m-1,day,h,min);
  for (let i=0;i<3;i++) {
    const parts = new Intl.DateTimeFormat('en-GB',{timeZone:d.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
    const f = (type:string) => Number(parts.find(p=>p.type===type)?.value);
    const seen = Date.UTC(f('year'),f('month')-1,f('day'),f('hour'),f('minute'));
    guess += Date.UTC(y,m-1,day,h,min)-seen;
  }
  const wanted=`${d.date_local} ${d.time_local}`;
  const local=(ms:number)=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:d.timezone!,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const f=(type:string)=>parts.find(p=>p.type===type)?.value;
    return `${f('year')}-${f('month')}-${f('day')} ${f('hour')}:${f('minute')}`;
  };
  if(local(guess)!==wanted)throw new Error('Nonexistent local clock time at this timezone');
  if([1800000,3600000,7200000].some(offset=>local(guess-offset)===wanted||local(guess+offset)===wanted))throw new Error('Ambiguous local clock time at daylight saving change');
  return new Date(guess);
}

export function displayDeadline(d: Record<string, any>) {
  const day = new Date(`${d.date_local}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  let instant:Date|null=null;
  try{instant=deadlineInstant({date_local:d.date_local,time_local:d.time_local,timezone:d.timezone});}catch{instant=null;}
  const ist = instant?.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'});
  return {local:`${day}${d.time_local ? ` · ${d.time_local} ${d.timezone ?? 'timezone unknown'}` : ' · closing time unknown'}`,ist:ist ?? 'IST conversion unavailable'};
}

export function sourceChangeKey(sourceId:string, hash:string) { return `source:${sourceId}:${hash}`; }
export function reminderKey(deadlineId:string, point:string) {return `reminder:${deadlineId}:${point}`;}

export function isOfficialUrl(raw:string) {
  let u:URL;
  try {u=new URL(raw);} catch {return false;}
  if (u.protocol!=='https:' || u.username || u.password || u.port) return false;
  const host=u.hostname.toLowerCase();
  return !/^(localhost|\d+\.\d+\.\d+\.\d+|\[.*\])$/.test(host) &&
    !host.endsWith('.local') && !host.endsWith('.internal') && !host.endsWith('.localhost') &&
    /^[a-z0-9.-]+$/.test(host) && host.includes('.');
}

export function words(text:string) {return text.trim().split(/\s+/).filter(Boolean).length;}

export function indiaDate(now:Date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(x=>x.type===type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isSubmittedState(status:string) {
  return ['submitted','under_review','interview','offer','conditional_offer','rejected','waitlisted','accepted','declined','deferred'].includes(status);
}
