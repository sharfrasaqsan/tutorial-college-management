"use client";

import { Activity, ShieldCheck, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-20 py-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 px-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1.5">
            Institutional Management System
          </p>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
            © {new Date().getFullYear()} SmartAcademy • Secured by Cloud Matrix v2.4.0
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enterprise Audited</span>
        </div>
        <div className="w-px h-4 bg-slate-200"></div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
            Architected with <Heart className="w-2.5 h-2.5 text-rose-500 inline mx-0.5 fill-rose-500" /> by <span className="text-slate-900">AM. Sharfras Aqsan</span>
        </p>
      </div>
    </footer>
  );
}
