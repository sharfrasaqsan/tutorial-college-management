"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditCard, Plus, Search, Filter, Calendar, Download, ArrowUpRight, ArrowDownLeft, X } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Payment } from "@/types/models";
import Link from "next/link";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  useEffect(() => {
    async function loadPayments() {
      try {
        const q = query(collection(db, "payments"), orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);
        setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      } catch (error) {
        console.error("Error loading payments", error);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.studentName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "" || p.status === filterStatus;
    const matchesMethod = filterMethod === "" || p.method === filterMethod;
    const matchesMonth = filterMonth === "" || p.month === filterMonth;
    
    return matchesSearch && matchesStatus && matchesMethod && matchesMonth;
  });

  const clearFilters = () => {
    setFilterStatus("");
    setFilterMethod("");
    setFilterMonth("");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financial Records</h2>
          <p className="text-sm text-slate-500">Track all student fee payments and transactions.</p>
        </div>
        <div className="flex gap-2">
            <Link href="/admin/payments/record" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20">
                <Plus className="w-4 h-4" /> Record New Payment
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
            { label: "Total Revenue", value: "LKR 1.2M", icon: ArrowUpRight, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "This Month", value: "LKR 125,500", icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Pending Fees", value: "08 Students", icon: ArrowDownLeft, color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Total Transactions", value: "142", icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((stat, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                    <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                    </div>
                </div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                {loading ? (
                    <Skeleton variant="text" width="80px" height="24px" className="mt-1" />
                ) : (
                    <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                )}
            </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by student name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
                <Filter className="w-4 h-4" /> Filters
                {(filterStatus || filterMethod || filterMonth) && (
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                )}
            </button>
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 grid grid-cols-1 sm:grid-cols-4 gap-4 animate-in slide-in-from-top duration-300">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Method</label>
                <select 
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Month</label>
                <input 
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
             </div>
             <div className="flex items-end">
                <button 
                  onClick={clearFilters}
                  className="w-full h-[38px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Clear All
                </button>
             </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          {loading ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><Skeleton variant="text" width="60px" height="12px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="120px" height="14px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="80px" height="12px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="100px" height="16px" /></td>
                    <td className="px-6 py-4"><Skeleton variant="text" width="60px" height="12px" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton variant="rect" width="60px" height="20px" className="ml-auto rounded" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Method</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length > 0 ? filteredPayments.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400 uppercase">{item.id.substring(0,8)}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{item.studentName}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {item.createdAt && typeof item.createdAt.toDate === 'function' 
                        ? item.createdAt.toDate().toLocaleDateString() 
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-900">LKR {item.amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 uppercase text-[10px] font-black text-slate-400">{item.method}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${item.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.status || 'Verified'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">No transactions found matching your criteria.</td>
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
