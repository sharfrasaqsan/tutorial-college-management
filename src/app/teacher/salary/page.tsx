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
      title: "Progress",
      value: `${Math.round(stats.pendingPercent)}%`,
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-[1400px] mx-auto">
      {/* 🏛️ Mission Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Payment History
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider leading-none">
            Your payment logs •{" "}
            <span className="text-indigo-600 font-black">
              {teacherData?.name?.split(" ")[0]}
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
            className="bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-300 hover:border-indigo-300 group shadow-sm hover:shadow-xl"
          >
            <div className="flex flex-col gap-4">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg} ${card.color} group-hover:scale-110 transition-transform shadow-sm`}
              >
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  {card.title}
                </p>
                <p className="text-lg font-black text-slate-900 leading-none">
                  {card.value}
                </p>
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

      {/* 📜 Audit Ledger Registry */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-100/40 overflow-hidden flex flex-col group/table hover:border-indigo-100 transition-all duration-700">
        <div className="px-10 py-10 border-b border-slate-50 flex items-center justify-between bg-white relative">
          <div className="flex items-center gap-5">
            <div className="w-1.5 h-10 bg-indigo-600 rounded-full group-hover/table:scale-y-110 transition-transform shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
            <div>
              <h3 className="font-black text-slate-800 tracking-[0.2em] uppercase text-xs">
                Payment List
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1.5 opacity-80">
                History of your payments
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
              {filteredSalaries.length} Payments Found
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-5">Month</th>
                <th className="px-10 py-5">Date Paid</th>
                <th className="px-10 py-5">Amount</th>
                <th className="px-10 py-5">Status</th>
                <th className="px-10 py-5 text-right">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSalaries.length > 0 ? (
                filteredSalaries.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/20 transition-all duration-500 group/row"
                  >
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all shadow-sm">
                          {item.month.charAt(0)}
                        </div>
                        <p className="font-black text-slate-900 tracking-tight uppercase text-sm group-hover/row:text-indigo-600 transition-colors uppercase">
                          {item.month}
                        </p>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 tabular-nums">
                          {item.createdAt?.toDate
                            ? format(item.createdAt.toDate(), "dd MMMM, yyyy")
                            : "Pending Audit"}
                        </span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider mt-0.5">
                          Verified Registry
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-black text-slate-300">
                          LKR
                        </span>
                        <span className="font-black text-slate-900 text-sm tracking-tight">
                          {item.netAmount?.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm transition-all ${
                          item.status === "paid"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100 group-hover/row:bg-emerald-600 group-hover/row:text-white"
                            : "bg-amber-50 text-amber-600 border-amber-100 group-hover/row:bg-amber-600 group-hover/row:text-white"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${item.status === "paid" ? "bg-emerald-500 group-hover/row:bg-white" : "bg-amber-500 group-hover/row:bg-white"}`}
                        ></div>
                        {item.status}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                          ID: {item.id.substring(0, 8).toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handlePrint(item)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                            title="Export Institutional Invoice"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleShare(item)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                            title="Share Reference"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-10 py-32 text-center">
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 shadow-inner">
                        <History className="w-10 h-10" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                          No Payments Found
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 leading-loose max-w-sm mx-auto">
                          Your payment history is currently empty.
                        </p>
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
