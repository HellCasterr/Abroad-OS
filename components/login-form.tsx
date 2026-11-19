'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export function LoginForm(){
  const [email,setEmail]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');const [failed,setFailed]=useState(false);
  async function signIn(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('');setFailed(false);
    try{const {error}=await browserClient().auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:`${location.origin}/auth/callback`}});
      if(error)throw error;
      setMessage('Sign-in link requested. Check your inbox and spam folder; use the link in this browser.');
    }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Could not send a sign-in link. Please try again.');}finally{setBusy(false);}
  }
  return <div className="login-card"><p className="eyebrow">PRIVATE WORKSPACE</p><h2>Welcome back</h2><p>Sign in with a link sent to your email. Your files and records remain accessible only to you.</p><form onSubmit={signIn}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="primary full" disabled={busy}>{busy?'Sending…':'Send sign-in link'}</button></form>{message&&<p role={failed?'alert':'status'} className={failed?'login-error':'login-success'}>{message}</p>}<div className="login-card-bottom">No password to remember · Secured by Supabase Auth</div></div>;
}
