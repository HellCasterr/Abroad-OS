export function nextOccurrence(date:Date,recurrence:string,now=new Date()){
  const next=new Date(date);
  for(let i=0;i<400&&next<=now;i++){
    if(recurrence==='daily')next.setUTCDate(next.getUTCDate()+1);
    else if(recurrence==='weekly')next.setUTCDate(next.getUTCDate()+7);
    else if(recurrence==='monthly')next.setUTCMonth(next.getUTCMonth()+1);
    else return null;
  }
  return next>now?next:null;
}
