import {indiaDate} from './domain';

export type ChatCitation={id:string;title:string;url:string;status:string;checked_at?:string|null};
export type ChatAction={kind:'task'|'note';title:string;body:string;due_at:string|null};

export function allowedCitations(ids:string[],available:ChatCitation[]):ChatCitation[]{
  const lookup=new Map(available.map(x=>[x.id,x]));
  return [...new Set(ids)].map(id=>lookup.get(id)).filter((x):x is ChatCitation=>Boolean(x)).slice(0,6);
}

export function proposedAction(text:string,raw:{kind:string;title:string;body:string;due_at:string|null}):ChatAction|null{
  const taskIntent=/\b(add|create|make|set|remind|schedule)\b.{0,35}\b(task|reminder|to.do)\b|^remind me\b/i.test(text);
  const noteIntent=/\b(save|add|create|remember)\b.{0,25}\bnote\b/i.test(text);
  if(raw.kind==='task'&&taskIntent&&raw.title.trim().length>=3){
    const due=!/\bdeadline\b/i.test(text)&&raw.due_at&&Number.isFinite(Date.parse(raw.due_at))&&Date.parse(raw.due_at)>Date.now()?new Date(raw.due_at).toISOString():null;
    return {kind:'task',title:raw.title.trim().slice(0,300),body:raw.body.trim().slice(0,1500),due_at:due};
  }
  if(raw.kind==='note'&&noteIntent&&raw.body.trim().length>=3)return {kind:'note',title:raw.title.trim().slice(0,300)||'Save note',body:raw.body.trim().slice(0,3000),due_at:null};
  return null;
}

export function fallbackAnswer(text:string,context:{applications:Array<{status:string;programme_id?:string}>;programmes:Array<{id:string;institution:string}>;tasks:Array<{title:string;due_at:string|null}>;deadlines:Array<{label:string;date_local:string;status:string}>;documents:Array<{category:string}>;scholarships:Array<{name:string}>;fundingPlans:Array<{programme_id:string;currency:string;tuition_per_year:number|null;living_per_month:number|null;stipend_per_month:number|null;initial_cash_required:number|null}>}){
  const open=context.tasks.filter(x=>!x.due_at||Date.parse(x.due_at)>=Date.now()).slice(0,4);
  const dates=context.deadlines.filter(x=>x.status==='verified'&&x.date_local>=indiaDate()).slice(0,3);
  const summary=`Your workspace has ${context.applications.length} admission applications, ${context.scholarships.length} scholarship leads, ${context.documents.length} uploaded documents, and ${context.tasks.length} open tasks.`;
  if(/deadline|when|upcoming/i.test(text))return dates.length?`Verified upcoming deadlines: ${dates.map(x=>`${x.label} (${x.date_local}; confirm the source time in Calendar)`).join('; ')}. I won't guess an unverified date.`:'No verified upcoming deadlines are recorded. Review official sources in Source Monitor before relying on a date.';
  if(/document|file|upload|transcript/i.test(text))return `${context.documents.length} files are in your private vault. Open Documents to see categories and readiness. I can read a selected file only when OpenAI is connected and you approve sharing its contents for a message.`;
  if(/funding|cost|tuition|stipend|compare/i.test(text))return context.fundingPlans.length?`Recorded estimates (user reported; no currency conversion): ${context.fundingPlans.slice(0,5).map(x=>`${context.programmes.find(p=>p.id===x.programme_id)?.institution||'Programme'}: tuition ${x.tuition_per_year??'unknown'}, living/month ${x.living_per_month??'unknown'}, potential stipend/month ${x.stipend_per_month??'unknown'}, upfront cash ${x.initial_cash_required??'unknown'} ${x.currency}`).join('; ')}. Check official sources and award status before deciding.`:'No funding estimates are recorded yet. Add tuition, living costs, stipends and upfront cash in Funding Planner; unknown values will stay unknown.';
  if(/application|submitted|offer|status/i.test(text))return context.applications.length?`Admission pipeline: ${context.applications.slice(0,8).map(x=>`${context.programmes.find(p=>p.id===x.programme_id)?.institution||'Programme'} — ${x.status.replaceAll('_',' ')}`).join('; ')}. Submitted does not mean admitted.`:'No admission applications are tracked yet. Open Opportunities to add one.';
  return `${summary}${open.length?` Next tasks: ${open.map(x=>x.title).join('; ')}.`:''} ${dates.length?`Next verified date: ${dates[0].label} (${dates[0].date_local}).`:'No verified upcoming deadline is recorded.'} OpenAI is not connected, so this answer uses your saved workspace data only.`;
}
