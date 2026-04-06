"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DollarSign, Search, Filter, Download, CreditCard, User, MoreHorizontal, AlertCircle } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Salary } from "@/types/models";

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadSalaries() {
      try {
        const q = query(collection(db, "salaries"), orderBy("month", "desc"));
        const snap = await getDocs(q);
        setSalaries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
      } catch (error) {
        console.error("Error loading salaries", error);
      } finally {
        setLoading(false);
      }
    }
    loadSalaries();
  }, []);

  const filteredSalaries = salaries.filter(s => 
    s.teacherName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Faculty Payroll</h2>
          <p className="text-sm text-slate-500">Manage and track teacher salary payments.</p>
        </div>
        <div className="flex gap-2">
           <button className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
           </button>
           <button className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20">
            <CreditCard className="w-4 h-4" /> Process Salary
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-blue-600 rounded-3xl text-white shadow-lg shadow-blue-200">
           <div className="flex justify-between items-start mb-6">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Payouts</span>
           </div>
           <p className="text-sm font-medium opacity-80 mb-1">Total Payout (This Month)</p>
           {loading ? (
             <Skeleton variant="text" width="120px" height="32px" className="bg-white/20" />
           ) : (
             <h3 className="text-3xl font-black">LKR 425,000</h3>
           )}
        </div>
        
        <div className="p-6 bg-emerald-600 rounded-3xl text-white shadow-lg shadow-emerald-200">
           <div className="flex justify-between items-start mb-6">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Unpaid</span>
           </div>
           <p className="text-sm font-medium opacity-80 mb-1">Pending Salaries</p>
           {loading ? (
             <Skeleton variant="text" width="100px" height="32px" className="bg-white/20" />
           ) : (
             <h3 className="text-3xl font-black">04 Records</h3>
           )}
        </div>

        <div className="p-6 bg-slate-800 rounded-3xl text-white shadow-lg shadow-slate-200">
           <div className="flex justify-between items-start mb-6">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <User className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Staff</span>
           </div>
           <p className="text-sm font-medium opacity-80 mb-1">Active Faculty</p>
           {loading ? (
             <Skeleton variant="text" width="100px" height="32px" className="bg-white/20" />
           ) : (
             <h3 className="text-3xl font-black">12 Teachers</h3>
           )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by teacher name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 transition-all font-medium"
            />
          </div>
          <button className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-5">Faculty Member</th>
                  <th className="px-6 py-5">Month</th>
                  <th className="px-6 py-5">Basic Salary</th>
                  <th className="px-6 py-5">Net Payable</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                        <Skeleton variant="text" width="120px" height="14px" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="60px" height="12px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="100px" height="14px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="100px" height="16px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="rect" width="70px" height="24px" className="rounded-md" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton variant="rect" width="32px" height="32px" className="ml-auto rounded-lg" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-5">Faculty Member</th>
                  <th className="px-6 py-5">Month</th>
                  <th className="px-6 py-5">Basic Salary</th>
                  <th className="px-6 py-5">Net Payable</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {item.teacherName?.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-800">{item.teacherName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{item.month}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">LKR {item.basicAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4 font-black text-slate-900">LKR {item.netAmount?.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${item.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {item.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-800 transition-all hover:bg-slate-100 rounded-lg">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center flex flex-col items-center">
                       <DollarSign className="w-12 h-12 text-slate-100 mb-4" />
                       <p className="text-slate-500 font-medium">No salary records found matching your selection.</p>
                       <button className="mt-2 text-primary hover:underline text-xs font-bold">Show current month only</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
