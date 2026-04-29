"use client";

import { ShieldCheck, Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 py-6 border-t border-slate-100">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-md shadow-primary/20">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 tracking-tight leading-none">SmartAcademy</p>
            <p className="text-[9px] font-medium text-slate-400 mt-0.5">
              © {new Date().getFullYear()} Institutional Management Platform
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Secured</span>
          </div>
          <div className="w-px h-3.5 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">v2.4.0</span>
          </div>
          <div className="w-px h-3.5 bg-slate-200" />
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            Cloud Matrix Platform
          </p>
        </div>
      </div>
    </footer>
  );
}
