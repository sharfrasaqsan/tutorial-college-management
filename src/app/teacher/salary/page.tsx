"use client";

import { useState, useEffect } from "react";
import { collection, query, where, doc, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Banknote, TrendingUp, Calendar, ChevronDown, CheckCircle, Clock, Filter, X, History, Wallet, Share2, Printer } from "lucide-react";
import { Salary, Teacher, Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";

export default function SalaryHistoryPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    
    // Listen for salaries
    const qSalaries = query(collection(db, "salaries"), where("teacherId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubSalaries = onSnapshot(qSalaries, (snap) => {
      setSalaries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
      setLoading(false);
    });

    // Listen for teacher data
    const unsubTeacher = onSnapshot(doc(db, "teachers", user.uid), (snap) => {
        if (snap.exists()) setTeacherData({ id: snap.id, ...snap.data() } as Teacher);
    });

    // Listen for classes (to compute pending sessions)
    const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    return () => {
        unsubSalaries();
        unsubTeacher();
        unsubClasses();
    };
  }, [user]);

  const totalEarnings = salaries.reduce((acc, curr) => acc + (curr.netAmount || 0), 0);
  const lastPayment = salaries[0];
  const pendingSessions = classes.reduce((acc, curr) => acc + Math.max(0, curr.sessionsSinceLastPayment || 0), 0);
  const totalCycleBenchmark = classes.reduce((acc, curr) => acc + (curr.sessionsPerCycle || 8), 0) || 8;

  const filteredSalaries = salaries.filter(s => {
    const matchesMonth = filterMonth === "" || s.month.toLowerCase().includes(filterMonth.toLowerCase());
    const matchesStatus = filterStatus === "" || s.status === filterStatus;
    
    if (filterMonth && filterMonth.includes('-')) {
        const [y, m] = filterMonth.split('-');
        const date = s.createdAt?.toDate?.() || new Date();
        const matchesDate = date.getFullYear() === parseInt(y) && (date.getMonth() + 1) === parseInt(m);
        return matchesDate && matchesStatus;
    }

    return matchesMonth && matchesStatus;
  });

  const clearFilters = () => {
    setFilterMonth("");
    setFilterStatus("");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center pb-2">
             <Skeleton variant="text" width="240px" height="36px" />
             <Skeleton variant="rect" width="120px" height="40px" className="rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[1,2,3].map(i => <Skeleton key={i} variant="rect" width="100%" height="160px" className="rounded-[3rem]" />)}
        </div>
        <Skeleton variant="rect" width="100%" height="400px" className="rounded-[2.5rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Institutional Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1.5">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-4 group">
                <div className="bg-indigo-600 p-2.5 rounded-[1.25rem] shadow-xl shadow-indigo-100 group-hover:rotate-6 transition-transform duration-500">
                    <Wallet className="w-7 h-7 text-white" />
                </div>
                Financial Disbursement
            </h2>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Institutional compensation & audit logs</p>
        </div>
        <div className="flex items-center gap-3">
            <Link href="/teacher/timetable" className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm uppercase tracking-widest hover:border-indigo-200 group">
                <Calendar className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" /> Timetable
            </Link>
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                <button className="p-2.5 hover:bg-indigo-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600"><Share2 className="w-4 h-4" /></button>
                <div className="w-[1px] h-4 bg-slate-100 self-center"></div>
                <button className="p-2.5 hover:bg-indigo-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600"><Printer className="w-4 h-4" /></button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* The Signature 'Gold' Card */}
        <div className="bg-slate-900 p-8 rounded-[3.5rem] shadow-2xl shadow-slate-200 text-white relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 border border-slate-800">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-indigo-500/30 transition-all"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div className="flex items-center justify-between mb-8">
                        <div className="bg-indigo-500/20 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                            <Banknote className="w-6 h-6 text-indigo-400" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400/80 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">Audit Active</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2">Total Career Earnings</p>
                    <h4 className="text-4xl font-black tracking-tight leading-none">
                        <span className="text-indigo-400">LKR</span> {totalEarnings.toLocaleString()}
                    </h4>
                </div>
                <div className="mt-8 flex items-center gap-3">
                    <div className="flex items-center gap-2 text-[10px] bg-emerald-500/10 text-emerald-400 w-fit px-4 py-2 rounded-xl font-black uppercase tracking-widest border border-emerald-500/20 backdrop-blur-sm">
                        <TrendingUp className="w-3.5 h-3.5" /> Institutional Standard
                    </div>
                </div>
            </div>
            {/* Visual flair */}
            <div className="absolute bottom-4 right-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <History className="w-32 h-32 text-white" />
            </div>
        </div>

        {/* Recent Credit Card */}
        <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 space-y-6 flex flex-col justify-between group hover:border-indigo-100 transition-all duration-500">
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-inner">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Most Recent Credit</p>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">{lastPayment?.month || 'No Cycle'}</h4>
                    </div>
                </div>
                <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-50 group-hover:bg-indigo-50/30 group-hover:border-indigo-50 transition-all duration-500">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Net Disbursement</p>
                    <p className="text-3xl font-black text-slate-900 leading-none tracking-tight">LKR {lastPayment?.netAmount?.toLocaleString() || '0'}</p>
                </div>
            </div>
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl w-full text-[10px] font-black uppercase tracking-widest border transition-all ${lastPayment?.status === 'paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${lastPayment?.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                Status: {lastPayment?.status || 'Pending'}
            </div>
        </div>

        {/* Unpaid Progress Card */}
        <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col justify-between text-center group hover:border-indigo-100 transition-all duration-500">
             <div className="pt-4">
                 <div className="w-20 h-20 bg-indigo-50/50 rounded-[2rem] mx-auto flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-lg shadow-indigo-100 group-hover:shadow-indigo-200">
                    <History className="w-10 h-10" />
                 </div>
                 <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em] leading-none mb-2">Unpaid Progress</h4>
                 <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-all duration-500">
                    <p className="text-lg font-black text-slate-800 tracking-tight">{pendingSessions}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessions logged</p>
                 </div>
             </div>
             <div>
                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mb-3">
                    <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (pendingSessions / totalCycleBenchmark) * 100)}%` }}></div>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progress toward next cycle ({totalCycleBenchmark} sessions total)</p>
             </div>
        </div>
      </div>

      <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden flex flex-col group/table">
        <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row gap-6 items-center justify-between">
            <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                    Historical Ledger
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional Audit Record</p>
            </div>
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => setShowFilters(!showFilters)}
                 className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border ${showFilters ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-800 hover:border-slate-300'}`}
               >
                 <Filter className="w-3.5 h-3.5" /> Filters
                 {(filterMonth || filterStatus) && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></div>}
               </button>
               <button className="px-5 py-2.5 bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 border border-slate-100">
                 Audit Export <ChevronDown className="w-3.5 h-3.5" />
               </button>
            </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-6 border-b border-slate-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-300">
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Fiscal Month</label>
                <input 
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
                />
             </div>
             <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Payment Status</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
                >
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                </select>
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
        
        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/80 text-[10px] font-black uppercase text-slate-400 tracking-[0.25em] border-b border-slate-100">
                        <th className="px-10 py-6 w-1/4">Fiscal Month</th>
                        <th className="px-10 py-6">Computation Date</th>
                        <th className="px-10 py-6">Net Computation</th>
                        <th className="px-10 py-6">Status</th>
                        <th className="px-10 py-6 text-right">Reference</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading ? (
                        [1, 2, 3].map(i => <tr key={i} className="h-20 bg-white animate-pulse"></tr>)
                    ) : filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                        <tr key={item.id} className="hover:bg-indigo-50/20 transition-all duration-300 group/row">
                            <td className="px-10 py-7">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all duration-500 shadow-sm uppercase">
                                        {item.month.charAt(0)}
                                    </div>
                                    <p className="font-black text-slate-900 tracking-tight uppercase text-sm group-hover/row:text-indigo-600 transition-colors">{item.month}</p>
                                </div>
                            </td>
                            <td className="px-10 py-7">
                                <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                    {item.createdAt?.toDate ? format(item.createdAt.toDate(), "dd MMM, yyyy") : 'Pending Sync'}
                                </span>
                            </td>
                            <td className="px-10 py-7">
                                <p className="font-black text-slate-900 text-sm tracking-tight">LKR {item.netAmount?.toLocaleString()}</p>
                            </td>
                            <td className="px-10 py-7">
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all ${
                                    item.status === 'paid' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover/row:bg-emerald-500 group-hover/row:text-white group-hover/row:border-emerald-500' 
                                        : 'bg-amber-50 text-amber-600 border-amber-100 group-hover/row:bg-amber-500 group-hover/row:text-white group-hover/row:border-amber-500'
                                }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'paid' ? 'bg-emerald-500 group-hover/row:bg-white' : 'bg-amber-500 group-hover/row:bg-white'}`}></div>
                                    {item.status}
                                </div>
                            </td>
                            <td className="px-10 py-7 text-right">
                                <span className="font-mono text-[10px] text-slate-300 group-hover/row:text-slate-400 transition-colors bg-slate-50/50 px-3 py-1 rounded-lg border border-slate-100 uppercase">
                                    Ref: {item.id.substring(0,8).toUpperCase()}
                                </span>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="px-10 py-24 text-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200">
                                        <History className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <p className="text-slate-900 font-black uppercase tracking-[0.2em] text-xs">No records found</p>
                                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Institutional audit history is currently empty.</p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
