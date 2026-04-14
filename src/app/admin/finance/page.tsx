"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  X,
  CreditCard,
  Briefcase,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Download,
  Eye,
  ArrowRight,
  Loader2
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { format, addMonths, subMonths, setYear, setMonth } from "date-fns";
import { Payment, Salary } from "@/types/models";
import { formatMonthYear } from "@/lib/formatters";
import Link from "next/link";
import { generateMonthlyFinanceReportPDF } from "@/lib/pdf-generator";

export default function FinanceAnalyticsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Temporal Filter
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedMonth = format(selectedDate, "yyyy-MM");

  const loadFinanceData = async () => {
    setLoading(true);
    try {
      const [paymentsSnap, salariesSnap] = await Promise.all([
        getDocs(query(collection(db, "payments"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "salaries"), orderBy("createdAt", "desc")))
      ]);

      setPayments(paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
      setSalaries(salariesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
    } catch (error) {
      console.error("Finance Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));

  const availableYears = Array.from(new Set([
    new Date().getFullYear(),
    ...payments.map(p => {
        const parts = p.month?.split('-');
        return parts ? parseInt(parts[0]) : NaN;
    }),
    ...salaries.map(s => {
        const parts = s.month?.split('-');
        return parts ? parseInt(parts[0]) : NaN;
    })
  ])).filter(y => !isNaN(y)).sort((a, b) => b - a);

  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Filtered Data based on selection
  const monthlyIncome = payments.filter(p => p.month === selectedMonth && p.status === 'paid');
  const monthlyExpenses = salaries.filter(s => s.month === selectedMonth && s.status === 'paid');
  
  const pendingReceivables = payments.filter(p => p.month === selectedMonth && p.status !== 'paid');
  const pendingPayables = salaries.filter(s => s.month === selectedMonth && s.status !== 'paid');

  const incomeTotal = monthlyIncome.reduce((sum, p) => sum + (p.amount || 0), 0);
  const expenseTotal = monthlyExpenses.reduce((sum, s) => sum + (s.netAmount || 0), 0);
  const netProfit = incomeTotal - expenseTotal;

  const pendingIncomeTotal = pendingReceivables.reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingExpenseTotal = pendingPayables.reduce((sum, s) => sum + (s.netAmount || 0), 0);

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
        await generateMonthlyFinanceReportPDF(
            monthlyIncome,
            monthlyExpenses,
            {
                incomeTotal,
                expenseTotal,
                netProfit,
                pendingIncome: pendingIncomeTotal,
                pendingExpense: pendingExpenseTotal
            },
            selectedMonth
        );
    } finally {
        setIsExporting(false);
    }
  };

  const stats = [
    { title: "Net Revenue", value: `LKR ${incomeTotal.toLocaleString()}`, sub: "Fees Collected", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-50" },
    { title: "Net Expenses", value: `LKR ${expenseTotal.toLocaleString()}`, sub: "Salaries Settled", icon: TrendingDown, color: "text-rose-500", bg: "bg-rose-50" },
    { title: "Institutional Profit", value: `LKR ${netProfit.toLocaleString()}`, sub: "Liquidity", icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Arrears", value: `LKR ${pendingIncomeTotal.toLocaleString()}`, sub: "Pending Fees", icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="relative z-[60]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
            <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Command Center</h1>
            <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
                Profit & Loss Analytics • {formatMonthYear(selectedMonth)}
            </p>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={handleExportReport}
                    disabled={isExporting || (monthlyIncome.length === 0 && monthlyExpenses.length === 0)}
                    className="px-5 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[11px] font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                    {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} 
                    Generate Financial Audit
                </button>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden text-emerald-600">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-emerald-600"><ChevronLeft className="w-4 h-4" /></button>
                    <button 
                        onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-emerald-600 transition-all flex items-center gap-2"
                    >
                        {format(selectedDate, "MMMM yyyy")}
                        {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5 text-emerald-600" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />}
                    </button>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-emerald-600"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <button 
                    onClick={loadFinanceData}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm"
                >
                    <Clock className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* 📅 Premium Month Grid Selector (Overlay) */}
        {isCalendarExpanded && (
          <div className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 shadow-[0_32px_128px_-10px_rgba(16,185,129,0.2)] animate-in slide-in-from-top-4 duration-500 max-w-sm w-[calc(100vw-32px)] sm:w-80 overflow-hidden border-t-4 border-t-emerald-500 z-[100]">
            <div className="flex items-center justify-between gap-4 mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fiscal Horizon</h4>
                <div className="relative">
                    <button 
                    onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
                    className="px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:text-emerald-600 transition-all rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2"
                    >
                    {format(selectedDate, "yyyy")}
                    <ChevronDown className={`w-3 h-3 transition-transform ${isYearPickerOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isYearPickerOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-2 z-50 grid grid-cols-2 gap-1 min-w-[140px] animate-in fade-in scale-in-95">
                        {availableYears.map((y) => (
                        <button 
                            key={y} 
                            onClick={() => { setSelectedDate(setYear(selectedDate, y)); setIsYearPickerOpen(false); }}
                            className={`px-2 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${format(selectedDate, "yyyy") === y.toString() ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-500'}`}
                        >
                            {y}
                        </button>
                        ))}
                    </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                {months.map((m, i) => {
                    const isSelected = format(selectedDate, "MMMM") === m;
                    return (
                        <button 
                            key={m} 
                            onClick={() => { setSelectedDate(setMonth(selectedDate, i)); setIsCalendarExpanded(false); }}
                            className={`group relative py-4 flex flex-col items-center justify-center transition-all rounded-2xl border ${isSelected ? 'bg-emerald-600 border-emerald-600 shadow-xl shadow-emerald-100' : 'bg-slate-50/50 border-transparent hover:border-slate-200 hover:bg-white'}`}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                {m.substring(0, 3)}
                            </span>
                            {isSelected && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></div>
                            )}
                        </button>
                    );
                })}
            </div>

            <button 
                onClick={() => setIsCalendarExpanded(false)}
                className="w-full mt-6 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-rose-500 transition-colors border-t border-slate-50 pt-4"
            >
                Close Navigator
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
            [1, 2, 3, 4].map(idx => (
                <Skeleton key={idx} variant="rect" width="100%" height="90px" className="rounded-2xl" />
            ))
        ) : stats.map((stat, idx) => (
          <div 
            key={idx} 
            className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm group hover:border-primary/20 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${stat.color === 'text-emerald-500' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                Verified
              </div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider leading-none">{stat.title}</p>
              <h3 className="text-lg font-black text-slate-900 mt-1 tabular-nums transition-colors group-hover:text-primary">{stat.value}</h3>
              <p className="text-[9px] font-medium text-slate-400 mt-0.5 uppercase tracking-widest">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Income Stream */}
        <div className="xl:col-span-7 space-y-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-emerald-100 transition-all">
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white relative">
                   <div className="flex items-center gap-4">
                      <div className="w-1.5 h-8 bg-emerald-500 rounded-full"></div>
                      <div>
                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Revenue Stream</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Fee collections logged</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-black text-emerald-600 leading-none">LKR {incomeTotal.toLocaleString()}</p>
                      <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-1.5">{monthlyIncome.length} Transactions</p>
                   </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-4">Transaction / Student</th>
                                <th className="px-8 py-4">Mode</th>
                                <th className="px-8 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr className="h-40 bg-slate-50/20 animate-pulse"></tr>
                            ) : monthlyIncome.length > 0 ? monthlyIncome.map(p => (
                                <tr key={p.id} className="hover:bg-emerald-50/30 transition-all group/row">
                                    <td className="px-8 py-4">
                                        <p className="text-sm font-bold text-slate-800 group-hover/row:text-emerald-700 transition-colors">{p.studentName}</p>
                                        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">ID: {p.id.slice(-8).toUpperCase()} • {p.createdAt && typeof p.createdAt.toDate === 'function' ? format(p.createdAt.toDate(), "dd MMM") : 'Recent'}</p>
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">{p.method}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <p className="text-sm font-black text-slate-900 tabular-nums">LKR {p.amount?.toLocaleString()}</p>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] italic">No revenue movements for this cycle.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {monthlyIncome.length > 0 && (
                    <Link href="/admin/payments" className="p-4 bg-slate-50 text-center text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2">
                        Browse Full Revenue History <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>

            {/* Arrears Summary */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group/arrears">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-[80px] -mr-32 -mt-32 group-hover/arrears:scale-110 transition-transform duration-[2000ms]"></div>
                <div className="relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Fiscal Risk Index</p>
                            <h4 className="text-xl font-black">LKR {pendingIncomeTotal.toLocaleString()}</h4>
                            <p className="text-[9px] font-medium text-white/40 uppercase tracking-widest mt-1">Pending Student Receivables</p>
                        </div>
                        <div className="w-12 h-12 bg-white/10 rounded-2xl border border-white/5 flex items-center justify-center text-orange-400">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Expense Stream */}
        <div className="xl:col-span-5 space-y-4">
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-indigo-100 transition-all">
                <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white relative">
                   <div className="flex items-center gap-4">
                      <div className="w-1.5 h-8 bg-indigo-500 rounded-full"></div>
                      <div>
                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Payroll Outflow</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Settled faculty salaries</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-lg font-black text-indigo-600 leading-none">LKR {expenseTotal.toLocaleString()}</p>
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1.5">{monthlyExpenses.length} Authors</p>
                   </div>
                </div>

                <div className="overflow-y-auto max-h-[400px]">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-16 mx-4 my-4 bg-slate-50 rounded-xl animate-pulse"></div>)
                    ) : monthlyExpenses.length > 0 ? monthlyExpenses.map(s => (
                        <div key={s.id} className="px-8 py-5 flex items-center justify-between hover:bg-indigo-50/30 transition-all border-b border-slate-50 last:border-0 group/exp">
                            <div>
                                <p className="text-sm font-bold text-slate-800 group-hover/exp:text-indigo-700 transition-colors">{s.teacherName}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.className || 'General'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-slate-900 tabular-nums">LKR {s.netAmount?.toLocaleString()}</p>
                                <div className="flex gap-2 justify-end mt-1">
                                    <span className="text-[8px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter tabular-nums">{s.sessionsConducted} Sessions</span>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center space-y-3">
                            <Briefcase className="w-8 h-8 text-slate-100 mx-auto" />
                            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic leading-none">No salary disbursements recorded.</p>
                        </div>
                    )}
                </div>

                <Link href="/admin/salaries" className="p-4 bg-slate-50 text-center text-[9px] font-black uppercase tracking-widest text-slate-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 mt-auto">
                    Manage Faculty Payroll <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* Pending Payables Card */}
            <div className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm relative overflow-hidden group/pay">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover/pay:scale-125"></div>
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">Outstanding Obligations</p>
                        <h4 className="text-2xl font-black text-slate-800 tracking-tight tabular-nums">LKR {pendingExpenseTotal.toLocaleString()}</h4>
                        <div className="flex items-center gap-2 mt-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{pendingPayables.length} Pending Salaries</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
