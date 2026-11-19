import {NextRequest,NextResponse} from 'next/server';
import {createServerClient,type SetAllCookies} from '@supabase/ssr';

export async function proxy(request:NextRequest){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)return NextResponse.next({request});
  let response=NextResponse.next({request});
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{
    cookies:{getAll(){return request.cookies.getAll();},setAll(entries:Parameters<SetAllCookies>[0]){entries.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});entries.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}
  });
  await client.auth.getUser();return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|api/cron|api/email/webhook).*)']};
