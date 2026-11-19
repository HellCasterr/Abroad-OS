import { NextResponse } from 'next/server';
import { requireUser,adminClient } from '@/lib/supabase/server';
import { failure,sameOrigin } from '@/lib/http';

const initial = [
  {institution:'University of Göttingen',title:'MSc Applied Computer Science',country:'Germany',intake:'Summer 2027',status:'submitted',submitted_at:null,notes:'Aptitude test completed; admission decision pending.'},
  {institution:'University of Padua',title:'MSc Computer Science',country:'Italy',intake:'2027/28',status:'submitted',submitted_at:null,notes:'Submission reported; admission decision pending.'},
  {institution:'University of Hildesheim',title:'International MSc Software Engineering',country:'Germany',intake:'Summer 2027',status:'submitted',submitted_at:null,submitted_date:'2026-11-16',notes:'Under review per user report; submission confirmed 16 November 2026.'},
  {institution:'University of Pavia',title:'MSc Computer Engineering',country:'Italy',intake:'2027/28',status:'paused',submitted_at:null,notes:'Preparation done; payment and submission unconfirmed. Do not prompt until reactivated.'}
];
const watchlist=[
  ['University of Passau','MSc Artificial Intelligence Engineering','Germany','https://www.uni-passau.de/en/'],
  ['TU Dortmund University','MSc Data Science','Germany',null],
  ['University of Hildesheim','MSc Data Analytics','Germany','https://www.uni-hildesheim.de/en/'],
  ['RPTU Kaiserslautern-Landau','MSc Computer Science','Germany',null],
  ['University of Luxembourg','MSc Computer Science','Luxembourg','https://www.uni.lu/'],
  ['KAUST','MSc Computer Science','Saudi Arabia','https://admissions.kaust.edu.sa/'],
  ['MBZUAI','MSc Artificial Intelligence','UAE','https://mbzuai.ac.ae/']
] as const;
const funding=[
  ['DAAD scholarships','DAAD','https://www.daad.in/en/find-funding/scholarship-database/'],
  ['Erasmus Mundus Joint Masters','European Commission','https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters'],
  ['ETH Zurich ESOP','ETH Zurich','https://ethz.ch/'],
  ['EPFL Excellence Fellowships','EPFL','https://www.epfl.ch/'],
  ['Paris-Saclay Eiffel nominations','Université Paris-Saclay','https://www.universite-paris-saclay.fr/'],
  ['Stipendium Hungaricum','Hungarian Government',null],
  ['Padua funding','University of Padua','https://www.unipd.it/en/'],
  ['CYBERSURE Erasmus Mundus','CYBERSURE consortium','https://www.cybersure-master.eu/admission/scholarships-and-fees'],
  ['EDISS Erasmus Mundus','EDISS consortium','https://www.master-ediss.eu/admission/'],
  ['DEAI Erasmus Mundus','DEAI consortium','https://deai.ulb.be/home/students/admission/'],
  ['IMSISS Erasmus Mundus','IMSISS consortium','https://www.securityintelligence-erasmusmundus.eu/apply/'],
  ['EMILDAI Erasmus Mundus','EMILDAI consortium','https://emildai.eu/admissions/how-to-apply/']
] as const;

export async function POST(request:Request){try{
  sameOrigin(request);const {db,user}=await requireUser();
  if(!process.env.OWNER_EMAIL || user.email?.toLowerCase()!==process.env.OWNER_EMAIL.toLowerCase())throw new Error('FORBIDDEN');
  // Check server permissions before the first write. Every insert below is idempotent so a failed run can be resumed.
  const admin=adminClient();
  const {error:profileError}=await db.from('profiles').upsert({user_id:user.id,email:user.email,full_name:'Bhomik Jain',nationality:'Indian',degree:'BE Computer Science and Engineering',institution:'Chandigarh University',graduation_year:2025,cgpa:7.81,aps_status:'verified',aps_reference:process.env.OWNER_APS_REFERENCE||null,dmat_score:'217/400 — General Academic',moi_status:'certificate dated 2026-10-08',ielts_status:'booked',ielts_test_date:'2026-12-09',facts_status:'user_reported',preferences:{goal:'15 high-quality applications',funding:'full funding first; tuition-free public universities second',regions:['Germany','Italy','France','Switzerland','Austria','Luxembourg','Finland','Sweden','Europe','Saudi Arabia','UAE']}},{onConflict:'user_id',ignoreDuplicates:true});
  if(profileError)throw profileError;
  for(const item of initial){
    const {error:pe}=await db.from('programmes').upsert({user_id:user.id,institution:item.institution,title:item.title,country:item.country,intake:item.intake,paused:item.status==='paused',status:'verification_required',notes:item.notes},{onConflict:'user_id,institution,title,intake',ignoreDuplicates:true});
    if(pe)throw pe;
    const {data:p,error:lookupError}=await db.from('programmes').select('id').eq('institution',item.institution).eq('title',item.title).eq('intake',item.intake).single();
    if(lookupError)throw lookupError;
    const {error:ae}=await db.from('applications').upsert({user_id:user.id,programme_id:p.id,status:item.status,status_evidence:item.status==='submitted'?'user_confirmed':'user_reported',submitted_at:item.submitted_at,submitted_date:'submitted_date' in item?item.submitted_date:null,official_id:item.institution==='University of Hildesheim'?(process.env.OWNER_HILDESHEIM_APPLICATION_ID||null):null,payment_status:'unknown'},{onConflict:'user_id,programme_id',ignoreDuplicates:true});
    if(ae)throw ae;
  }
  for(const [institution,title,country,official_url] of watchlist){const {error}=await db.from('programmes').upsert({user_id:user.id,institution,title,country,official_url,intake:'2027 (verification required)',status:'verification_required'},{onConflict:'user_id,institution,title,intake',ignoreDuplicates:true});if(error)throw error;}
  for(const [name,funder,official_url] of funding){const {error}=await db.from('scholarships').upsert({user_id:user.id,name,funder,official_url,status:'verification_required'},{onConflict:'user_id,name',ignoreDuplicates:true});if(error)throw error;
    if(official_url&&['CYBERSURE Erasmus Mundus','EDISS Erasmus Mundus','DEAI Erasmus Mundus','IMSISS Erasmus Mundus','EMILDAI Erasmus Mundus'].includes(name)){
      const {data:s,error:sourceLookup}=await db.from('scholarships').select('id').eq('name',name).single();if(sourceLookup)throw sourceLookup;
      if(s){const {error}=await db.from('sources').upsert({user_id:user.id,scholarship_id:s.id,url:official_url,title:`${name} official call`,authority:'official_unreviewed',monitor_enabled:true},{onConflict:'user_id,url',ignoreDuplicates:true});if(error)throw error;}
    }
  }
  for(const [title,priority] of [
    ['Upload submission confirmations for Göttingen, Padua, and Hildesheim',3],
    ['Upload IELTS result after the 9 December Academic test',2],
    ['Verify official deadlines for the 2027 watchlist',3]
  ] as const){const {data:existingTask,error:lookup}=await db.from('tasks').select('id').eq('title',title).limit(1).maybeSingle();if(lookup)throw lookup;if(!existingTask){const {error}=await db.from('tasks').insert({user_id:user.id,title,priority});if(error)throw error;}}
  const {error:auditError}=await admin.from('audit_logs').insert({user_id:user.id,action:'initial_import_checked',entity:'profile'});if(auditError)throw auditError;
  return NextResponse.json({ok:true,imported:4,watchlist:watchlist.length,funding:funding.length});
}catch(e){return failure(e);}}
