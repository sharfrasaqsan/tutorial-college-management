"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Banknote, TrendingUp, Calendar, CreditCard, ChevronDown, CheckCircle, Clock, Filter, X } from "lucide-react";
import { Salary } from "@/types/models";
import { useAuth } from "@/context/AuthContext";

export default function SalaryHistoryPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    async function loadSalaries() {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, "salaries"), where("teacherId", "==", user.uid), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setSalaries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
      } catch (error) {
        console.error("Error loading salary data", error);
      } finally {
        setLoading(false);
      }
    }
    loadSalaries();
  }, [user]);

  const totalEarnings = salaries.reduce((acc, curr) => acc + (curr.netAmount || 0), 0);
  const lastPayment = salaries[0];

  const filteredSalaries = salaries.filter(s => {
    const matchesMonth = filterMonth === "" || s.month.includes(filterMonth);
    const matchesStatus = filterStatus === "" || s.status === filterStatus;
    return matchesMonth && matchesStatus;
  });

  const clearFilters = () => {
    setFilterMonth("");
    setFilterStatus("");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-700 p-8 rounded-[3rem] shadow-xl shadow-indigo-100/50 text-white relative overflow-hidden group hover:scale-[1.02] transition-all">
            <div className="relative z-10 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Total Career Earnings</p>
                <h4 className="text-4xl font-black tracking-tight leading-none mb-4">LKR {totalEarnings.toLocaleString()}</h4>
                <div className="flex items-center gap-2 text-[10px] bg-white/10 w-fit px-3 py-1.5 rounded-full font-bold uppercase tracking-widest backdrop-blur-sm">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> System Tracked
                </div>
            </div>
            <Banknote className="absolute -bottom-10 -right-10 w-48 h-48 text-indigo-400/20 group-hover:scale-125 transition-transform duration-700" />
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 flex flex-col justify-center">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Most Recent Credit</p>
                <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase">{lastPayment?.month || '---'} Cycle</h4>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Pay</p>
                    <p className="text-lg font-black text-indigo-600 leading-none">LKR {lastPayment?.netAmount?.toLocaleString() || '0'}</p>
                </div>
                <div className={`p-4 h-full rounded-3xl border flex items-center justify-center ${lastPayment?.status === 'paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>
                    {lastPayment?.status === 'paid' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
            </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-2 flex flex-col justify-center text-center">
             <div className="w-16 h-16 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-slate-400 mb-2 group hover:bg-slate-200 transition-colors">
                <CreditCard className="w-8 h-8" />
             </div>
             <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Payment Mode</h4>
             <p className="font-bold text-slate-500 text-xs">Standard Direct Bank Transfer</p>
             <button className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-2 hover:underline">Update Method</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-8 border-b border-slate-50 bg-slate-50/20 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-600" /> Historical Ledger</h3>
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => setShowFilters(!showFilters)}
                 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${showFilters ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-800'}`}
               >
                 <Filter className="w-3.5 h-3.5" /> Filters
                 {(filterMonth || filterStatus) && <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse opacity-100"></span>}
               </button>
               <button className="text-xs font-bold text-slate-400 hover:text-slate-800 flex items-center gap-1 transition-colors uppercase tracking-widest">
                 Generate PDF Statement <ChevronDown className="w-3 h-3" />
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
        
        <div className="overflow-x-auto min-h-[300px]">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] w-1/4">Fiscal Month</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Computation Date</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Net Computation</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Status</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Reference</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading ? (
                        [1, 2, 3].map(i => <tr key={i} className="h-16 bg-white animate-pulse"></tr>)
                    ) : filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                        <tr key={item.id} className="hover:bg-indigo-50/10 transition-all font-medium text-slate-700">
                            <td className="px-8 py-5">
                                <p className="font-black text-slate-900 tracking-tight uppercase">{item.month}</p>
                            </td>
                            <td className="px-8 py-5 text-sm text-slate-500">
                                {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending Sync'}
                            </td>
                            <td className="px-8 py-5 font-black text-slate-900">
                                LKR {item.netAmount?.toLocaleString()}
                            </td>
                            <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                    {item.status}
                                </span>
                            </td>
                            <td className="px-8 py-5 text-right font-mono text-[10px] text-slate-300">
                                SL-{item.id.substring(0,8).toUpperCase()}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-medium tracking-tight">No salary disbursements recorded in the ledger.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
