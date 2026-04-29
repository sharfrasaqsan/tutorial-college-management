"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, where, doc, updateDoc, deleteDoc, writeBatch, increment, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, DollarSign, Search, Filter, Download, CreditCard, AlertCircle, CheckCircle, Printer, Share2, Trash2, Eye, History as HistoryIcon, FileText, Send, MessageCircle, ArrowRight, Clock, Users, Hash, X, Calendar, TrendingUp, Calculator, ShieldCheck, Activity, BookOpen } from "lucide-react";
import { generateSalaryPDF } from "@/lib/pdf-generator";
import { Teacher } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import { Salary } from "@/types/models";
import SalaryProcessModal from "@/components/admin/SalaryProcessModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { formatMonthYear, formatDate } from "@/lib/formatters";
import { createNotification } from "@/hooks/useNotifications";

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTeachersCount, setActiveTeachersCount] = useState(0);
  
  // Historical Filtering
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState("");
  const [classList, setClassList] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState("");
  const [teachersData, setTeachersData] = useState<Record<string, Teacher>>({});

  // Actions states
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [salaryToDelete, setSalaryToDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'overview' | 'history'>('overview');

  const loadData = async () => {
    try {
      setLoading(true);
      const [salarySnap, teacherSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, "salaries"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "teachers"), where("status", "==", "active"))),
        getDocs(query(collection(db, "classes"), where("status", "==", "active")))
      ]);
      setSalaries(salarySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
      setActiveTeachersCount(teacherSnap.size);
      setClassList(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const teacherMap: Record<string, Teacher> = {};
      teacherSnap.docs.forEach(doc => {
        teacherMap[doc.id] = { id: doc.id, ...doc.data() } as Teacher;
      });
      setTeachersData(teacherMap);
    } catch (error) {
      console.error("Error loading payroll data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleStatus = async (item: Salary) => {
    try {
      const newStatus = item.status === 'paid' ? 'pending' : 'paid';
      const batch = writeBatch(db);
      
      // 1. Update salary status
      batch.update(doc(db, "salaries", item.id), { 
        status: newStatus,
        paidAt: newStatus === 'paid' ? serverTimestamp() : null 
      });
      
      // 2. Lock or unlock session completions based on new status
      const completionsQ = query(
        collection(db, "session_completions"),
        where("salaryId", "==", item.id)
      );
      const completionsSnap = await getDocs(completionsQ);
      completionsSnap.docs.forEach(compDoc => {
        batch.update(doc(db, "session_completions", compDoc.id), {
          isPaid: newStatus === 'paid'
        });
      });
      
      await batch.commit();
      
      if (newStatus === 'paid') {
        await createNotification({
          userId: item.teacherId,
          title: "Salary Advice",
          message: `Your payment for ${item.month ? formatMonthYear(item.month) : 'recent cycle'} has been authorized. Amount: Rs. ${(item.netAmount || 0).toLocaleString()}`,
          type: "success",
          link: "/teacher/salary"
        });
      }

      toast.success(newStatus === 'paid' ? "Fiscal Authorization Successful: Salary record locked and sessions marked as settled." : "Transaction Reverted: Salary status set to pending and sessions unlocked for editing.");
      loadData();
    } catch {
      toast.error("Process Error: Failed to synchronize salary status with the institutional ledger.");
    }
  };

  const handleDelete = async () => {
    if (!selectedSalary) return;
    setActionLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Purge the salary record
      batch.delete(doc(db, "salaries", selectedSalary.id));
      
      // 2. Adjust Class Aggregate (Hard Reset)
      // We decrement the cumulative total. We do NOT increment sessionsSinceLastPayment 
      // because the sessions themselves are being removed, and the teacher will re-log them.
      if (selectedSalary.classId) {
        batch.update(doc(db, "classes", selectedSalary.classId), {
          completedSessions: increment(-(selectedSalary.sessionsConducted || 0))
        });
      }

      // 3. Purge corresponding session completion logs (Revert to Incomplete)
      const completionsQ = query(
        collection(db, "session_completions"),
        where("salaryId", "==", selectedSalary.id)
      );
      const completionsSnap = await getDocs(completionsQ);
      completionsSnap.docs.forEach(compDoc => {
        batch.delete(doc(db, "session_completions", compDoc.id));
      });

      await batch.commit();
      
      toast.success("Hard Reset Successful: Payroll record purged and associated sessions restored for re-processing.");
      setIsDeleteOpen(false);
      setSelectedSalary(null);
      loadData();
    } catch (error) {
      console.error("Deletion error:", error);
      toast.error("Failed to delete record. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = async (salary: Salary) => {
    toast.promise(generateSalaryPDF(salary), {
        loading: "Generating institutional salary slip...",
        success: "Salary record exported successfully!",
        error: "Failed to generate records. Contact administration."
    });
  };

  const handleShare = async (salary: Salary) => {
    const shareText = `Institutional Salary Reference: #INV-SLY-${salary.id.slice(-8).toUpperCase()}\nFaculty: ${salary.teacherName}\nAmount: LKR ${(salary.netAmount || 0).toLocaleString()}\nStatus: ${(salary.status || 'pending').toUpperCase()}`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: "Institutional Payroll Record",
                text: shareText
            });
        } catch (err) {}
    } else {
        navigator.clipboard.writeText(shareText);
        toast.success("Record reference copied to clipboard for sharing.");
    }
  };

  const handleWhatsAppShare = (item: Salary) => {
    const teacher = teachersData[item.teacherId];
    if (!teacher || !teacher.phone) {
        toast.error("Contact number not found for this faculty member.");
        return;
    }

    const cleanPhone = teacher.phone.replace(/\D/g, '');
    const cycle = item.month ? formatMonthYear(item.month) : "N/A";
    const amount = (item.netAmount || 0).toLocaleString();
    const status = (item.status || "pending").toUpperCase();
    const className = item.className || "Class Completion";

    const message = encodeURIComponent(
        `*OFFICIAL SALARY ADVICE*\n` +
        `--------------------------\n` +
        `*Faculty:* ${item.teacherName || 'Faculty Member'}\n` +
        `*Class:* ${className}\n` +
        `*Cycle:* ${cycle}\n` +
        `*Amount:* LKR ${amount}\n` +
        `*Status:* ${status}\n\n` +
        `Your monthly settlement has been authorized. You can view your detailed payslip on the teacher dashboard.`
    );
    
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const filteredSalaries = salaries.filter(s => {
    const currentTeacherName = teachersData[s.teacherId]?.name || s.teacherName || "";
    const matchesSearch = currentTeacherName.toLowerCase().includes(searchTerm.toLowerCase());
    const [sYear, sMonth] = s.month.split('-');
    const matchesYear = filterYear === "" || sYear === filterYear;
    const matchesMonth = filterMonth === "" || sMonth === filterMonth;
    const matchesClass = filterClass === "" || s.classId === filterClass;
    return matchesSearch && matchesYear && matchesMonth && matchesClass;
  });

  const totalPayout = salaries.reduce((sum, s) => s.status === 'paid' ? sum + (s.netAmount || 0) : sum, 0);
  const pendingCount = salaries.filter(s => s.status === 'pending').length;
  const currentYear = new Date().getFullYear().toString();
  const availableYears = Array.from(new Set([
    currentYear,
    ...salaries.map(s => s.month.split('-')[0])
  ])).sort((a, b) => b.localeCompare(a));
  
  const cleanClassName = (name: string) => name?.replace(/\s*\([^)]*\)$/, "").trim() || "N/A";

  const statCards = [
    { title: "Total Paid", value: `LKR ${totalPayout.toLocaleString()}`, icon: DollarSign, color: "text-indigo-500" },
    { title: "To Pay", value: pendingCount, icon: Clock, color: "text-orange-500" },
    { title: "Active Teachers", value: activeTeachersCount, icon: Users, color: "text-blue-500" },
    { title: "Completed Months", value: salaries.filter(s => s.status === 'paid').length, icon: CheckCircle, color: "text-emerald-500" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teacher Payments</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
            Review and send teacher payments
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
        >
          <CreditCard className="w-3.5 h-3.5" /> Process Salary
        </button>
      </div>

      {/* 🏛️ Specialized Stats Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4">
        {loading ? (
            [1, 2, 3, 4].map(idx => (
                <Skeleton key={idx} variant="rect" width="100%" height="80px" className="rounded-2xl" />
            ))
        ) : statCards.map((card, idx) => (
          <div 
            key={idx} 
            className={`bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-200 hover:border-primary/30 group shadow-sm`}
          >
            <div className="flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color.replace('text-', 'bg-').split('-').slice(0, 2).join('-')}-50 ${card.color} transition-all shadow-sm`}>
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{card.title}</p>
                <div className="flex items-center gap-1">
                  <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary transition-colors">{card.value}</p>
                  <ArrowRight className="w-2.5 h-2.5 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SalaryProcessModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={loadData} />
      <ConfirmModal 
        isOpen={isDeleteOpen} 
        onClose={() => setIsDeleteOpen(false)} 
        onConfirm={handleDelete} 
        loading={actionLoading} 
        title="Warning: Clear Record" 
        message={`Warning: Deleting this record for ${teachersData[selectedSalary?.teacherId || '']?.name || selectedSalary?.teacherName || 'this faculty member'} will clear the ${selectedSalary?.sessionsConducted} session logs. The teacher will need to mark them again. This cannot be undone.`}
      />

      {/* 🚀 Institutional Payroll Record Modal - Premium Layout */}
      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isViewOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isViewOpen ? "backdrop-blur-sm" : ""}`} onClick={() => setIsViewOpen(false)}></div>
        
        <div className={`relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isViewOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
            
            {/* Header Segment */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold overflow-hidden shadow-sm">
                        {teachersData[selectedSalary?.teacherId || '']?.photoURL ? (
                           <img src={teachersData[selectedSalary?.teacherId || '']?.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                           (teachersData[selectedSalary?.teacherId || '']?.name || selectedSalary?.teacherName || "?").charAt(0)
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 leading-none">
                            {teachersData[selectedSalary?.teacherId || '']?.name || selectedSalary?.teacherName}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                             <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Hash className="w-3.5 h-3.5" /> ID: {teachersData[selectedSalary?.teacherId || '']?.teacherId || "N/A"}
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
                        onClick={() => selectedSalary && handleWhatsAppShare(selectedSalary)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#25D366]/10 text-[#25D366] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#25D366] hover:text-white transition-all border border-[#25D366]/20 active:scale-95"
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                    </button>
                    <button 
                        onClick={() => selectedSalary && handleShare(selectedSalary)}
                        className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-primary transition-all border border-slate-100"
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
                        className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${activeModalTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        {tab === 'overview' ? 'Overview' : 'Faculty History'}
                        {activeModalTab === tab && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all" />
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
                                        { label: 'Settlement Month', value: selectedSalary.month, icon: Calendar, color: 'bg-primary/5 text-primary border-primary/10' },
                                        { label: 'Sessions Conducted', value: `${selectedSalary.sessionsConducted} Units`, icon: Activity, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                        { label: 'Final Payout', value: `LKR ${selectedSalary.netAmount?.toLocaleString()}`, icon: DollarSign, color: 'bg-indigo-50 text-indigo-500 border-indigo-100' },
                                        { label: 'Authorization', value: selectedSalary.status.toUpperCase(), icon: ShieldCheck, color: 'bg-slate-50 text-slate-500 border-slate-200' },
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
                                            <div className="p-6 rounded-[2rem] border border-slate-100 bg-slate-50/50 group hover:border-primary/20 transition-all">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary mb-4 shadow-sm group-hover:scale-110 transition-transform">
                                                   <BookOpen className="w-5 h-5" />
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
                                                        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500"><Users className="w-4 h-4" /></div>
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
                                                       <TrendingUp className="w-3 h-3" /> Fully Leveraged
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
                                        {salaries.filter(s => s.teacherId === selectedSalary.teacherId).length} Records Found
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
                                            {salaries.filter(s => s.teacherId === selectedSalary.teacherId).map((prev) => (
                                                <tr key={prev.id} className={`hover:bg-slate-50/50 transition-colors ${prev.id === selectedSalary.id ? 'bg-primary/5' : ''}`}>
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
                    <ShieldCheck className="w-4 h-4 text-slate-300" />
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


      {/* Main Workspace */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Payment List</h3>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none mt-1">Manage teacher payments and history</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <select 
                        value={filterClass}
                        onChange={(e) => setFilterClass(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                        <option value="">All Classes</option>
                        {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>

                    <select 
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                        <option value="">Year</option>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <select 
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    >
                        <option value="">Month</option>
                        {[
                        { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" }, 
                        { v: "04", n: "Apr" }, { v: "05", n: "May" }, { v: "06", n: "Jun" },
                        { v: "07", n: "Jul" }, { v: "08", n: "Aug" }, { v: "09", n: "Sep" },
                        { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" }
                        ].map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
                    </select>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search Name..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-48"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Teacher</th>
                    <th className="px-6 py-4 text-center">Month</th>
                    <th className="px-6 py-4">Requested Date</th>
                    <th className="px-6 py-4">Paid Date</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-6 py-6">
                           <div className="h-10 bg-slate-50 rounded-lg w-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group/row">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 relative group-hover/row:border-primary/30 transition-all overflow-hidden">
                              {teachersData[item.teacherId]?.photoURL ? (
                                <img src={teachersData[item.teacherId]?.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (teachersData[item.teacherId]?.name || item.teacherName || "?").charAt(0)
                              )}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 hover:text-primary transition-colors leading-none">
                                  {teachersData[item.teacherId]?.name || item.teacherName || "Unknown Faculty"}
                                </p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tight font-medium">
                                  {teachersData[item.teacherId]?.teacherId || "N/A"} • {cleanClassName(item.className)}
                                </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-widest">
                                {formatMonthYear(item.month)}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {formatDate(item.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                            {item.status === 'paid' ? formatDate(item.paidAt) : <span className="text-slate-300 italic">Pending...</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                            <p className="font-bold text-slate-900 tabular-nums">LKR {item.netAmount?.toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${item.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {item.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button onClick={() => { setSelectedSalary(item); setIsViewOpen(true); }} className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => toggleStatus(item)} className={`p-2 transition-colors rounded-lg ${item.status === 'paid' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 hover:text-green-600 hover:bg-green-50'}`} title="Change Status"><CheckCircle className="w-4 h-4" /></button>
                            
                            <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>

                            <button onClick={() => handlePrint(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg" title="Print/Export PDF"><Printer className="w-4 h-4" /></button>
                            <button onClick={() => handleShare(item)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors hover:bg-indigo-50 rounded-lg" title="Share Reference"><Share2 className="w-4 h-4" /></button>
                            
                            {item.status === 'paid' && (
                                <button onClick={() => handleWhatsAppShare(item)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors hover:bg-emerald-50 rounded-lg" title="Send WhatsApp Advice"><MessageCircle className="w-4 h-4" /></button>
                            )}

                            <div className="w-[1px] h-4 bg-slate-100 mx-1"></div>

                            <button onClick={() => { setSelectedSalary(item); setIsDeleteOpen(true); setSalaryToDelete(item.id); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-6 py-24 text-center text-slate-500 font-medium">No records found.</td></tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </div>
    </div>
  );
}
