"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ClipboardCheck, Calendar, Clock, FileText, Filter, X } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { AttendanceRecord } from "@/types/models";
import Link from "next/link";

export default function AttendanceHistoryPage() {
  const { user } = useAuth();
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  useEffect(() => {
    async function loadAttendanceLogs() {
      if (!user?.uid) return;
      try {
        const q = query(
          collection(db, "attendance"), 
          where("teacherId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const snap = await getDocs(q);
        const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        setAttendanceLogs(logs);

        // Extract unique class names for filters
        const classes = new Set<string>();
        logs.forEach((l) => {
            if (l.className) classes.add(l.className);
        });
        setAvailableClasses(Array.from(classes));
      } catch (error) {
        console.error("Error loading attendance history", error);
      } finally {
        setLoading(false);
      }
    }
    loadAttendanceLogs();
  }, [user]);

  const filteredLogs = attendanceLogs.filter(log => {
      const matchesClass = filterClass === "" || log.className === filterClass;
      const matchesDate = filterDate === "" || log.date === filterDate;
      return matchesClass && matchesDate;
  });

  const clearFilters = () => {
      setFilterClass("");
      setFilterDate("");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <ClipboardCheck className="w-8 h-8 text-indigo-600" /> Attendance Ledger
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">Manage and monitor all submitted registers for your sessions. You can review participation rates and academic session historical data.</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm self-start md:self-auto gap-2">
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showFilters ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'} flex items-center gap-2`}
            >
                <Filter className="w-3.5 h-3.5" /> Filters
                {(filterClass || filterDate) && <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse ml-1 opacity-100"></span>}
            </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-300">
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">By Class</label>
              <select 
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
              >
                <option value="">All Taught Classes</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Specific Date</label>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
              />
           </div>
           <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="w-full sm:w-auto px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all h-[42px] flex items-center justify-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> Clear All
              </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
                <div className="flex items-center gap-6 flex-1">
                  <Skeleton variant="rect" width="56px" height="56px" className="rounded-2xl" />
                  <div className="space-y-3">
                    <Skeleton variant="text" width="180px" height="24px" />
                    <Skeleton variant="text" width="120px" height="12px" />
                  </div>
                </div>
                <div className="flex items-center gap-10">
                  <div className="space-y-2">
                    <Skeleton variant="text" width="60px" height="10px" className="mx-auto" />
                    <Skeleton variant="text" width="100px" height="24px" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton variant="rect" width="40px" height="40px" className="rounded-xl" />
                    <Skeleton variant="rect" width="120px" height="40px" className="rounded-xl" />
                  </div>
                </div>
              </div>
            ))
        ) : filteredLogs.length > 0 ? filteredLogs.map((log: AttendanceRecord) => {
            const records = log.records || {};
            const total = Object.keys(records).length;
            const present = Object.values(records).filter(v => v).length;
            const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

            return (
                <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/40 transition-all group flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                    <div className="flex items-center gap-6 flex-1">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                             <Calendar className="w-5 h-5 mb-0.5" />
                             <span className="text-[10px] font-black uppercase tracking-tighter leading-none">{new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                        </div>
                        
                        <div className="space-y-1">
                            <h4 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1 group-hover:text-indigo-600 transition-colors uppercase">{log.className}</h4>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                <Clock className="w-3 h-3 text-indigo-500" /> Authorized @ {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-10">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Participation</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xl font-black text-slate-800">{percentage}%</span>
                                <div className="h-6 w-px bg-slate-100"></div>
                                <span className="text-xs font-bold text-emerald-600">{present}/{total}</span>
                            </div>
                        </div>

                        <div className="h-10 w-px bg-slate-100 hidden md:block"></div>

                        <div className="flex gap-2">
                            <button className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors"><FileText className="w-4 h-4" /></button>
                            <Link 
                                href={`/teacher/attendance/mark?classId=${log.classId}`}
                                className="bg-indigo-50 text-indigo-700 p-3 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                            >
                                Edit Check-in
                            </Link>
                        </div>
                    </div>
                    {/* Abstract design element */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700"></div>
                </div>
            )
        }) : (
            <div className="py-40 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <ClipboardCheck className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                <p className="text-slate-500 font-bold tracking-tight text-xl mb-1">No attendance logs found in the ledger.</p>
                <p className="text-slate-400 text-xs tracking-tight uppercase font-black tracking-widest">Start marking registers to populate the history ledger.</p>
            </div>
        )}
      </div>
    </div>
  );
}
