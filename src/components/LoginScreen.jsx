import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LAB_CONFIG } from '../config/lab.config';

export default function LoginScreen({ onLogin }) {
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });
  const [showRegModal, setShowRegModal] = useState(false);
  const [regData, setRegData] = useState({ name: '', email: '', code: '', password: '' });

  async function handleLogin(e) {
    e.preventDefault();
    const id = loginData.identifier.trim();
    const { data, error } = await supabase
      .from('authorized_users')
      .select('*')
      .or(`email.eq."${id}",user_code.eq."${id.toUpperCase()}"`)
      .eq('password', loginData.password)
      .single();

    if (error || !data) return alert('Invalid credentials.');
    if (!data.is_approved) return alert('Account pending admin approval.');
    onLogin(data);
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!regData.email.includes('@')) return alert('Enter a valid email address.');
    const { error } = await supabase.from('authorized_users').insert([{
      full_name: regData.name,
      email: regData.email,
      user_code: regData.code.toUpperCase(),
      password: regData.password,
      is_approved: false,
    }]);
    if (error) {
      alert('Error: email or code already registered.');
    } else {
      alert(`Registration successful. Contact ${LAB_CONFIG.admin.name} for approval.`);
      setShowRegModal(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
        <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white mb-6">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
          {LAB_CONFIG.appName}
        </h1>
        <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest mb-8">
          {LAB_CONFIG.suite}
        </p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            required
            placeholder="Email or code (e.g. EBR)"
            className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm"
            onChange={e => setLoginData({ ...loginData, identifier: e.target.value })}
          />
          <input
            required
            type="password"
            placeholder="Password"
            className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none text-sm"
            onChange={e => setLoginData({ ...loginData, password: e.target.value })}
          />
          <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black transition-all">
            Enter
          </button>
        </form>
        <button
          onClick={() => setShowRegModal(true)}
          className="mt-6 text-xs font-bold text-blue-600 hover:underline"
        >
          Request access
        </button>
      </div>

      {showRegModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-[3rem] w-full max-w-md relative">
            <button onClick={() => setShowRegModal(false)} className="absolute top-8 right-8 text-slate-300">
              <X />
            </button>
            <h2 className="text-2xl font-black mb-6">Register</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <input required placeholder="Full name" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({ ...regData, name: e.target.value })} />
              <input required type="email" placeholder="email@institution.edu" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({ ...regData, email: e.target.value })} />
              <input required placeholder="3-letter code (e.g. EBR)" maxLength={3} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl uppercase font-bold" onChange={e => setRegData({ ...regData, code: e.target.value })} />
              <input required type="password" placeholder="Password" className="w-full px-5 py-3.5 bg-slate-50 rounded-xl" onChange={e => setRegData({ ...regData, password: e.target.value })} />
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg">
                Register
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
