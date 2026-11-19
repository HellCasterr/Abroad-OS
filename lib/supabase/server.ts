import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function serverClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (entries:Parameters<SetAllCookies>[0]) => {
        try { entries.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Server Component read only */ }
      }
    }
  });
}

export function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession:false, autoRefreshToken:false}
  });
}

export async function requireUser() {
  const db = await serverClient();
  const {data:{user},error} = await db.auth.getUser();
  if (error || !user) throw new Error('UNAUTHENTICATED');
  return {db,user};
}
