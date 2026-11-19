'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export function LoginForm(){
  const [email,setEmail]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');
    const {error}=await browserClient().auth.signInWithOtp({email,options:{emailRedirectTo:`${location.origin}/auth/callback`}});
    setMessage(error?.message ?? 'Check your inbox for a secure sign-in link.');setBusy(false);
  }
  return <div className="login-card"><p className="eyebrow">PRIVATE WORKSPACE</p><h2>Welcome back</h2><p>Sign in with a link sent to your email. Your files and records remain accessible only to you.</p><form onSubmit={signIn}><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="primary full" disabled={busy}>{busy?'Sending…':'Send sign-in link'}</button></form><p role="status" className="muted">{message}</p><div className="login-card-bottom">No password to remember · Secured by Supabase Auth</div></div>;
}
