"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, where, doc, updateDoc, deleteDoc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, DollarSign, Search, Filter, Download, CreditCard, AlertCircle, CheckCircle, Printer, Trash2, Eye, History as HistoryIcon, FileText, Send, MessageCircle, ArrowRight, Clock, Users } from "lucide-react";
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
      batch.update(doc(db, "salaries", item.id), { status: newStatus });
      
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

      toast.success(newStatus === 'paid' ? "Salary authorized — sessions locked." : "Salary reverted to pending — sessions unlocked.");
      loadData();
    } catch {
      toast.error("Failed to update status.");
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
      
      toast.success("Payroll record purged and sessions restored for re-processing.");
      setIsDeleteOpen(false);
      setSelectedSalary(null);
      loadData();
    } catch (error) {
      console.error("Deletion error:", error);
      toast.error("Critical: Fiscal rollback failed.");
    } finally {
      setActionLoading(false);
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
    const matchesSearch = s.teacherName?.toLowerCase().includes(searchTerm.toLowerCase());
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

  const statCards = [
    { title: "Authorized Payout", value: `LKR ${totalPayout.toLocaleString()}`, icon: DollarSign, color: "text-indigo-500" },
    { title: "Pending Claims", value: pendingCount, icon: Clock, color: "text-orange-500" },
    { title: "Faculty Reach", value: activeTeachersCount, icon: Users, color: "text-blue-500" },
    { title: "Settled Cycles", value: salaries.filter(s => s.status === 'paid').length, icon: CheckCircle, color: "text-emerald-500" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teacher Salaries</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
            Review and pay teacher salaries
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
        >
          <CreditCard className="w-3.5 h-3.5" /> Start Payroll
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
        title="CRITICAL: PURGE & HARD RESET" 
        message={`DANGER: Deleting this record for ${selectedSalary?.teacherName} will PERMANENTLY ERASE the ${selectedSalary?.sessionsConducted} attendance logs associated with it. The teacher will need to RE-MARK these sessions as completed before a new salary can be generated. This action cannot be undone.`}
      />

      {/* Breakdown Modal */}
      <Modal isOpen={isViewOpen} onClose={() => setIsViewOpen(false)} title={`Ledger Entry: ${selectedSalary?.teacherName}`}>
        <div className="space-y-5 p-2">
           <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Cycle</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">{selectedSalary?.month}</p>
             </div>
             <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-right">
                <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Net Payable</p>
                <p className="text-lg font-black text-indigo-600 tabular-nums">LKR {selectedSalary?.netAmount?.toLocaleString()}</p>
             </div>
           </div>
           <div className="space-y-4">
              <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-loose">Academic Unit</p>
                    <p className="text-sm font-black text-slate-800">{selectedSalary?.className}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-loose">Audit ID</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">#${selectedSalary?.classId?.slice(-6)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                 {[
                    { label: 'Monthly Fee', value: `LKR ${selectedSalary?.monthlyFee?.toLocaleString()}` },
                    { label: 'Students', value: `${selectedSalary?.studentCount} Enrolled` },
                    { label: 'Revenue', value: `LKR ${selectedSalary?.totalMonthlyRevenue?.toLocaleString()}` },
                 ].map((stat, i) => (
                    <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
                        <p className="text-[11px] font-black text-slate-700">{stat.value}</p>
                    </div>
                 ))}
              </div>

              <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10 flex items-center justify-between">
                 <div>
                    <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Sessions Authorized</p>
                    <h4 className="text-2xl font-black text-primary tabular-nums">{selectedSalary?.sessionsConducted} <span className="text-sm text-primary/40 font-bold">/ {selectedSalary?.sessionsPerCycle}</span></h4>
                 </div>
                 <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Calculated Rate</p>
                    <p className="text-sm font-black text-primary tabular-nums">LKR {selectedSalary?.perSessionRate?.toFixed(2)}</p>
                 </div>
              </div>
           </div>
           <button onClick={() => setIsViewOpen(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all shadow-xl shadow-slate-200">Close Transaction Review</button>
        </div>
      </Modal>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: DollarSign, label: 'Total Paid', value: `LKR ${totalPayout.toLocaleString()}`, sub: 'Paid this month' },
          { icon: AlertCircle, label: 'To Pay', value: `${pendingCount} Pending`, sub: 'Awaiting payment' },
          { icon: HistoryIcon, label: 'Total Teachers', value: `${activeTeachersCount} Active`, sub: 'Active staff members' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-200 hover:border-primary/30 group cursor-default">
             <div className="flex flex-col gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                    <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{stat.label}</p>
                  <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary leading-none transition-colors">{stat.value}</p>
                </div>
                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest opacity-60">{stat.sub}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Salary List</h3>
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
                    <th className="px-6 py-4">Month</th>
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
                        <td colSpan={6} className="px-6 py-6">
                           <div className="h-10 bg-slate-50 rounded-lg w-full"></div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group/row">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm border border-slate-200 relative group-hover/row:border-primary/30 transition-all">
                              {item.teacherName?.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800 hover:text-primary transition-colors leading-none">{item.teacherName}</p>
                                <p className="text-[10px] text-slate-500 mt-1">ID: {item.id.slice(-6).toUpperCase()}</p>
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
                            
                            {item.status === 'paid' && (
                                <>
                                    <button onClick={async () => await generateSalaryPDF(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg" title="Download PDF"><FileText className="w-4 h-4" /></button>
                                    <button onClick={() => handleWhatsAppShare(item)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors hover:bg-emerald-50 rounded-lg" title="WhatsApp"><MessageCircle className="w-4 h-4" /></button>
                                </>
                            )}

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
