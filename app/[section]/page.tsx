import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { Workspace } from '@/components/workspace';

const sections=['today','opportunities','scholarships','applications','calendar','documents','profile','notes','funding','advisor','monitor','settings'];
export default async function Section({params}:{params:Promise<{section:string}>}){
  const {section}=await params;
  if(!sections.includes(section)) redirect('/today');
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <div className="setup"><h1>AbroadOS needs Supabase configuration</h1><p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then apply the migration. See README.md.</p></div>;
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect('/login');
  return <Workspace section={section} email={user.email??''} userId={user.id}/>;
}
