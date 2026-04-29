"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  doc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ChevronDown,
  Filter,
  X,
  History,
  Share2,
  Printer,
  Activity,
  CreditCard,
  DollarSign,
  Calendar,
  Hash,
  Users,
} from "lucide-react";
import { Salary, Teacher, Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import toast from "react-hot-toast";
import { generateSalaryPDF } from "@/lib/pdf-generator";

export default function SalaryHistoryPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState(
    new Date().getFullYear().toString(),
  );
  const [filterStatus, setFilterStatus] = useState("");
  
  // Modal states
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'history'>('overview');

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    // Listen for salaries
    const qSalaries = query(
      collection(db, "salaries"),
      where("teacherId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsubSalaries = onSnapshot(qSalaries, (snap) => {
      setSalaries(
        snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Salary),
      );
      setLoading(false);
    });

    // Listen for teacher data
    const unsubTeacher = onSnapshot(doc(db, "teachers", user.uid), (snap) => {
      if (snap.exists())
        setTeacherData({ id: snap.id, ...snap.data() } as Teacher);
    });

    // Listen for classes (to compute pending sessions)
    const qClasses = query(
      collection(db, "classes"),
      where("teacherId", "==", user.uid),
    );
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setClasses(
        snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Class),
      );
    });

    return () => {
      unsubSalaries();
      unsubTeacher();
      unsubClasses();
    };
  }, [user]);

  const stats = useMemo(() => {
    const paidSalaries = salaries.filter((s) => s.status === "paid");
    const totalEarnings = paidSalaries.reduce(
      (acc, curr) => acc + (curr.netAmount || 0),
      0,
    );
    const lastPayment = paidSalaries[0];
    const pendingSessions = classes.reduce(
      (acc, curr) => acc + Math.max(0, curr.sessionsSinceLastPayment || 0),
      0,
    );
    const totalCycleBenchmark =
      classes.reduce((acc, curr) => acc + (curr.sessionsPerCycle || 8), 0) || 8;

    return {
      totalEarnings,
      lastPayment,
      pendingSessions,
      totalCycleBenchmark,
      pendingPercent: Math.min(
        100,
        (pendingSessions / totalCycleBenchmark) * 100,
      ),
    };
  }, [salaries, classes]);

  const cleanClassName = (name: string) => name?.replace(/\s*\([^)]*\)$/, "").trim() || "N/A";
  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return format(d, "dd MMM, yyyy");
  };

  const filteredSalaries = salaries.filter((s) => {
    const [sYear, sMonth] = s.month.split("-");
    const matchesMonth =
      filterMonth === "" || sMonth === filterMonth.padStart(2, "0");
    const matchesYear = filterYear === "" || sYear === filterYear;
    const matchesStatus = filterStatus === "" || s.status === filterStatus;
    return matchesMonth && matchesYear && matchesStatus;
  });

  const clearFilters = () => {
    setFilterMonth("");
    setFilterYear(new Date().getFullYear().toString());
    setFilterStatus("");
  };

  const handlePrint = async (salary: Salary) => {
    toast.promise(generateSalaryPDF(salary), {
        loading: "Generating institutional salary slip...",
        success: "Salary record exported successfully!",
        error: "Failed to generate records. Contact administration."
    });
  };

  const handleShare = async (salary: Salary) => {
    const shareData = {
        title: `Salary Receipt - ${salary.month}`,
        text: `Faculty Payment Receipt for ${salary.month}. Amount: LKR ${salary.netAmount.toLocaleString()}`,
        url: window.location.href
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {}
    } else {
        navigator.clipboard.writeText(`Invoice Ref: #INV-SLY-${salary.id.slice(-8).toUpperCase()}`);
        toast.success("Invoice Reference copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center py-4">
          <Skeleton variant="text" width="200px" height="32px" />
          <Skeleton
            variant="rect"
            width="120px"
            height="40px"
            className="rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              variant="rect"
              width="100%"
              height="100px"
              className="rounded-2xl"
            />
          ))}
        </div>
        <Skeleton
          variant="rect"
          width="100%"
          height="500px"
          className="rounded-[3rem]"
        />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Paid",
      value: `LKR ${stats.totalEarnings.toLocaleString()}`,
      icon: DollarSign,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      title: "Last Payment",
      value: stats.lastPayment
        ? `LKR ${stats.lastPayment.netAmount.toLocaleString()}`
        : "N/A",
      icon: CreditCard,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Classes to pay",
      value: stats.pendingSessions,
      icon: History,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      title: "Settlement Unit Progress",
      value: `${Math.round(stats.pendingPercent)}%`,
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-[1600px] mx-auto">
      {/* 🏛️ Mission Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Payment History
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider leading-none">
            Your payment logs •{" "}
            <span className="text-indigo-600 font-black">
               Faculty Authority Terminal
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm">
            <Printer className="w-3.5 h-3.5" /> Statement
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all border flex items-center gap-2 ${showFilters ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            <Filter className="w-3.5 h-3.5" />{" "}
            {showFilters ? "Close Filters" : "Filter Ledger"}
          </button>
        </div>
      </div>

      {/* 🚀 High-Density HUD Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-300 hover:border-primary/30 group shadow-sm"
          >
            <div className="flex flex-col gap-4">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg} ${card.color} transition-all shadow-sm`}
              >
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  {card.title}
                </p>
                <div className="flex items-center gap-1">
                    <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary transition-colors">
                        {card.value}
                    </p>
                    <Activity className="w-2.5 h-2.5 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 📑 Filtering Panel */}
      {showFilters && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl animate-in slide-in-from-top-4 duration-500 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-wider">
                Fiscal Year
              </label>
              <div className="relative">
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full pl-5 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold appearance-none focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">All Years</option>
                  {Array.from(
                    { length: 5 },
                    (_, i) => new Date().getFullYear() - 2 + i,
                  ).map((y) => (
                    <option key={y} value={y.toString()}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-wider">
                Month Horizon
              </label>
              <div className="relative">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full pl-5 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold appearance-none focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m.toString()}>
                      {format(new Date(2000, m - 1), "MMMM")}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-wider">
                Status Filter
              </label>
              <div className="relative flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="flex-1 pl-5 pr-10 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold appearance-none focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all cursor-pointer"
                >
                  <option value="">All States</option>
                  <option value="paid">Authorized</option>
                  <option value="pending">Awaiting Audit</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <button
                  onClick={clearFilters}
                  className="px-4 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                  title="Reset Filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Institutional Payroll Record Modal - Premium Layout */}
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isViewOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isViewOpen ? "backdrop-blur-sm" : ""}`} onClick={() => setIsViewOpen(false)}></div>
        
        <div className={`relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isViewOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
            
            {/* Header Segment */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold overflow-hidden shadow-sm">
                        {teacherData?.photoURL ? (
                           <img src={teacherData?.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                           (teacherData?.name || "F").charAt(0)
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 leading-none">
                            {teacherData?.name}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                             <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Hash className="w-3.5 h-3.5" /> ID: {teacherData?.teacherId || "N/A"}
                             </span>
                             <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                             <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedSalary?.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {selectedSalary?.status}
                             </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => selectedSalary && handlePrint(selectedSalary)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        PDF Slip
                    </button>
                    <button 
                        onClick={() => selectedSalary && handleShare(selectedSalary)}
                        className="p-2.5 rounded-xl bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-all border border-indigo-100"
                        title="Share Reference"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                    <div className="w-[1px] h-6 bg-slate-100 mx-1"></div>
                    <button 
                        onClick={() => setIsViewOpen(false)}
                        className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Navigation Bar */}
            <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
                {(['overview', 'history'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveModalTab(tab)}
                        className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${activeModalTab === tab ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        {tab === 'overview' ? 'Overview' : 'Faculty History'}
                        {activeModalTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full transition-all" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
                {selectedSalary && (
                    <div className="animate-in fade-in duration-500">
                        {activeModalTab === 'overview' && (
                            <div className="space-y-10">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Settlement Month', value: selectedSalary.month, icon: Calendar, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                                        { label: 'Sessions Conducted', value: `${selectedSalary.sessionsConducted} Units`, icon: Activity, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                        { label: 'Final Payout', value: `LKR ${selectedSalary.netAmount?.toLocaleString()}`, icon: DollarSign, color: 'bg-blue-50 text-blue-500 border-blue-100' },
                                        { label: 'Authorization', value: selectedSalary.status.toUpperCase(), icon: Activity, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                    ].map((stat, i) => (
                                        <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${stat.color}`}>
                                            <stat.icon className="w-4 h-4" />
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">{stat.label}</p>
                                                <p className="text-base font-bold tracking-tight">{stat.value}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                    <div className="space-y-8">
                                        <div>
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Class Assignment</h4>
                                            <div className="p-6 rounded-[2rem] border border-slate-100 bg-slate-50/50 group hover:border-indigo-100 transition-all">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm group-hover:scale-110 transition-transform">
                                                   <Activity className="w-5 h-5" />
                                                </div>
                                                <h5 className="font-bold text-slate-800 text-lg leading-tight mb-1">{cleanClassName(selectedSalary.className)}</h5>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Institutional Academic Unit</p>
                                                
                                                <div className="mt-6 pt-6 border-t border-slate-200/50 space-y-3">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="font-semibold text-slate-400">Class ID</span>
                                                        <span className="font-mono text-[10px] text-slate-600 font-bold">{selectedSalary.classId.substring(0, 10).toUpperCase()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2 space-y-8">
                                        <div>
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Settlement Metrics</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm space-y-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><Activity className="w-4 h-4" /></div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Census Data</p>
                                                            <p className="text-sm font-bold text-slate-800">{selectedSalary.studentCount} Registered Students</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500"><CreditCard className="w-4 h-4" /></div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Unit Revenue</p>
                                                            <p className="text-sm font-bold text-slate-800">LKR {selectedSalary.monthlyFee?.toLocaleString()} / Student</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl shadow-slate-200 relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                                                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Total Unit Value</p>
                                                    <p className="text-2xl font-black tabular-nums mb-1">LKR {selectedSalary.totalMonthlyRevenue?.toLocaleString()}</p>
                                                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                                       <Activity className="w-3 h-3" /> Fully Leveraged
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeModalTab === 'history' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Historical Settlement Records</h4>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">
                                        {salaries.length} Records Found
                                    </span>
                                </div>
                                <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4">Settlement Cycle</th>
                                                <th className="px-6 py-4">Class Unit</th>
                                                <th className="px-6 py-4 text-right">Amount</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {salaries.map((prev) => (
                                                <tr key={prev.id} className={`hover:bg-slate-50/50 transition-colors ${prev.id === selectedSalary.id ? 'bg-indigo-50/50' : ''}`}>
                                                    <td className="px-6 py-5">
                                                        <p className="font-bold text-slate-700 tabular-nums leading-none">{prev.month}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{formatDate(prev.createdAt)}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{cleanClassName(prev.className)}</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums">LKR {prev.netAmount?.toLocaleString()}</td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${prev.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {prev.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Segment */}
            <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-slate-300" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-0.5">Reference Index: #{selectedSalary?.id.slice(-12).toUpperCase()}</p>
                </div>
                <button 
                    onClick={() => setIsViewOpen(false)}
                    className="px-8 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all shadow-xl active:scale-95"
                >
                    Close Record
                </button>
            </div>
        </div>
      </div>

      {/* 📜 Audit Ledger Registry */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col group/table transition-all duration-700">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 relative">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-indigo-600 rounded-full group-hover/table:scale-y-110 transition-transform"></div>
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-sm tracking-tight">
                Payment List
              </h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mt-1">
                Your historical faculty settlements
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
              {filteredSalaries.length} Records Found
            </span>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-8 py-4">Academic Unit</th>
                <th className="px-8 py-4">Month</th>
                <th className="px-8 py-4">Requested Date</th>
                <th className="px-8 py-4">Paid Date</th>
                <th className="px-8 py-4 text-right">Amount</th>
                <th className="px-8 py-4 text-center">Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSalaries.length > 0 ? (
                filteredSalaries.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/50 transition-colors group/row"
                  >
                    <td className="px-8 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover/row:scale-110 transition-transform">
                             <Activity className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors leading-none">{cleanClassName(item.className)}</p>
                             <p className="text-[10px] text-slate-400 mt-1.5 font-medium uppercase tracking-tighter">Reference: #{item.id.slice(-8).toUpperCase()}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-widest">
                            {item.month}
                        </span>
                    </td>
                    <td className="px-8 py-4 text-xs font-medium text-slate-500">
                        {formatDate(item.createdAt)}
                    </td>
                    <td className="px-8 py-4 text-xs font-medium text-slate-500">
                        {item.status === 'paid' ? formatDate(item.paidAt) : <span className="text-slate-300 italic">Pending...</span>}
                    </td>
                    <td className="px-8 py-4 text-right">
                        <p className="font-bold text-slate-900 tabular-nums">LKR {item.netAmount?.toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                            {item.status}
                        </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button onClick={() => { setSelectedSalary(item); setIsViewOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors hover:bg-slate-100 rounded-lg" title="View"><Activity className="w-4 h-4" /></button>
                        <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>
                        <button onClick={() => handlePrint(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg" title="Print/Export PDF"><Printer className="w-4 h-4" /></button>
                        <button onClick={() => handleShare(item)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors hover:bg-indigo-50 rounded-lg" title="Share Reference"><Share2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 text-slate-300">
                       <Activity className="w-12 h-12" />
                       <p className="text-sm font-bold uppercase tracking-widest">No payment records detected</p>
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
