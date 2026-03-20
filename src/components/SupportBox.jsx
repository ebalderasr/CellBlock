import React from 'react';
import { LifeBuoy } from 'lucide-react';
import { LAB_CONFIG } from '../config/lab.config';

export default function SupportBox() {
  const { admin } = LAB_CONFIG;
  return (
    <div className="p-6 bg-slate-900 rounded-[2rem] text-white shadow-xl border border-slate-800">
      <div className="flex items-center gap-2 text-blue-400 mb-4">
        <LifeBuoy size={18} />
        <span className="text-[10px] font-black uppercase tracking-widest">Technical Support</span>
      </div>
      <p className="text-sm font-bold mb-1">{admin.name}</p>
      <a
        href={`mailto:${admin.email}`}
        className="text-[10px] text-blue-400 hover:underline block mb-4"
      >
        {admin.email}
      </a>
      <p className="text-[9px] text-slate-500 leading-relaxed border-t border-white/10 pt-4 italic">
        Contact support for account approval or to report any issue.
      </p>
    </div>
  );
}
