"use client";

import { History, Construction, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AttendancePage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-8">
         <div className="w-32 h-32 bg-primary/5 rounded-[40px] flex items-center justify-center border-2 border-dashed border-primary/20 animate-pulse">
            <History className="w-16 h-16 text-primary/20" />
         </div>
         <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-slate-100">
            <Construction className="w-6 h-6 text-amber-500" />
         </div>
      </div>

      <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-4">Module Maintenance</h2>
      <p className="text-slate-500 max-w-sm font-medium leading-relaxed mb-10">
        Attendance tracking and session logging are currently being recalibrated. 
        This module is temporarily offline while we optimize the institutional reporting engine.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link 
          href="/admin/dashboard" 
          className="px-8 py-3 bg-slate-800 text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
        >
           <ArrowLeft className="w-4 h-4" /> Return to Command
        </Link>
        <Link 
          href="/admin/classes" 
          className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
        >
           Manage Classes
        </Link>
      </div>

      <div className="mt-16 pt-8 border-t border-slate-100 w-full max-w-xs opacity-50">
         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scheduled for v2.0 Release</p>
      </div>
    </div>
  );
}
