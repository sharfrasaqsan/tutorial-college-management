"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, where, doc, updateDoc, deleteDoc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DollarSign, Search, Filter, Download, CreditCard, AlertCircle, CheckCircle, Printer, Trash2, Eye, History as HistoryIcon, FileText, Send, MessageCircle } from "lucide-react";
import { generateSalaryPDF } from "@/lib/pdf-generator";
import { Teacher } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import { Salary } from "@/types/models";
import SalaryProcessModal from "@/components/admin/SalaryProcessModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { formatMonthYear, formatDate } from "@/lib/formatters";

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
  const availableYears = Array.from(new Set(salaries.map(s => s.month.split('-')[0]))).sort((a, b) => b.localeCompare(a));

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-10">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                <div className="bg-primary p-3 rounded-2xl shadow-xl shadow-primary/20">
                    <DollarSign className="w-8 h-8 text-white" />
                </div>
                Payroll Central
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mt-2">Institutional fiscal management & settlement terminal</p>
        </div>
        <div className="flex items-center gap-3">
            <button className="px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm uppercase tracking-widest hover:border-primary/20">
                <Download className="w-4 h-4 text-primary" /> Export Ledger
            </button>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3.5 bg-primary text-white rounded-2xl text-[10px] font-black hover:bg-primary-dark transition-all flex items-center gap-2.5 shadow-xl shadow-primary/30 uppercase tracking-widest"
            >
                <CreditCard className="w-4 h-4 text-white" /> Start Payroll
            </button>
        </div>
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

      {/* Performance HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <DollarSign className="w-6 h-6" />, label: 'Total Disbursements', value: `LKR ${totalPayout.toLocaleString()}`, color: 'bg-primary/10 text-primary', sub: 'Calculated this month' },
          { icon: <AlertCircle className="w-6 h-6" />, label: 'Floating Liabilities', value: `${pendingCount} Pending`, color: 'bg-amber-50 text-amber-600', sub: 'Awaiting authorization' },
          { icon: <CheckCircle className="w-6 h-6" />, label: 'Authorized Faculty', value: `${activeTeachersCount} Teachers`, color: 'bg-emerald-50 text-emerald-600', sub: 'Active payroll profiles' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-700 group">
             <div className="flex justify-between items-start">
                <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                    {stat.icon}
                </div>
                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-300">{stat.label}</span>
             </div>
             <div className="mt-8">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{stat.sub}</p>
                {loading ? <Skeleton variant="text" width="60%" height="32px" /> : <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</h3>}
             </div>
          </div>
        ))}
      </div>

      {/* Main Workspace */}
      <div className="space-y-6">
        {/* Horizontal Pipeline View */}
        {salaries.length > 0 && (
            <div className="flex items-center gap-6 py-2 overflow-x-auto no-scrollbar scroll-smooth">
                <div className="flex items-center gap-3 px-4 py-2 opacity-60">
                    <HistoryIcon className="w-4 h-4 text-slate-400" />
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap">Recent Activity</span>
                </div>
                {salaries.slice(0, 8).map(s => (
                    <button 
                        key={s.id} 
                        onClick={() => { setSelectedSalary(s); setIsViewOpen(true); }}
                        className="flex items-center gap-3 px-5 py-3 bg-white border border-slate-100 rounded-2xl hover:border-primary/40 hover:shadow-lg transition-all shadow-sm group whitespace-nowrap"
                    >
                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                            {s.teacherName?.charAt(0)}
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black text-slate-700">{s.teacherName}</p>
                            <p className="text-[9px] font-bold text-primary tabular-nums">LKR {s.netAmount?.toLocaleString()}</p>
                        </div>
                    </button>
                ))}
            </div>
        )}

        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-100/30 overflow-hidden">
            {/* Unified Control Bar */}
            <div className="px-10 py-8 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between bg-white gap-6">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Search faculty identity..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-8 py-4 bg-slate-50 border-none rounded-2xl text-[11px] font-bold uppercase tracking-[0.1em] focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-inner">
                 <select 
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="bg-transparent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary outline-none"
                 >
                    <option value="">All Academic Units</option>
                    {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 <div className="w-px h-6 bg-slate-200"></div>
                 <select 
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="bg-transparent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none"
                 >
                    <option value="">All Years</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                 </select>
                 <div className="w-px h-6 bg-slate-200"></div>
                 <select 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="bg-transparent px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none"
                 >
                    <option value="">Month</option>
                    {[
                       { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" }, 
                       { v: "04", n: "Apr" }, { v: "05", n: "May" }, { v: "06", n: "Jun" },
                       { v: "07", n: "Jul" }, { v: "08", n: "Aug" }, { v: "09", n: "Sep" },
                       { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" }
                    ].map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
                 </select>
                 <button 
                    onClick={() => { setFilterYear(""); setFilterMonth(""); setFilterClass(""); setSearchTerm(""); }}
                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary transition-all"
                 >
                    <Filter className="w-5 h-5" />
                 </button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-[0.2em] text-[9px] border-b border-slate-50">
                  <tr>
                    <th className="px-10 py-6">Faculty Identity</th>
                    <th className="px-10 py-6">Ledger Cycle</th>
                    <th className="px-10 py-6">Processed On</th>
                    <th className="px-10 py-6 text-right">Net Settlement</th>
                    <th className="px-10 py-6 text-center">Authorization</th>
                    <th className="px-10 py-6 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="animate-pulse px-10"><td colSpan={6} className="px-10 py-8"><div className="h-10 bg-slate-50 rounded-2xl w-full"></div></td></tr>
                    ))
                  ) : (
                    filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-all duration-500 group/row border-b border-slate-50 last:border-none">
                        <td className="px-10 py-7">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-black group-hover/row:bg-primary group-hover/row:text-white transition-all shadow-inner text-sm">
                              {item.teacherName?.charAt(0)}
                            </div>
                            <div>
                                <p className="font-black text-slate-800 tracking-tight text-sm group-hover/row:text-primary transition-colors">{item.teacherName}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.className}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-7">
                            <span className="px-4 py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                {formatMonthYear(item.month)}
                            </span>
                        </td>
                        <td className="px-10 py-7 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {formatDate(item.createdAt)}
                        </td>
                        <td className="px-10 py-7 text-right">
                            <p className="text-xl font-black text-slate-900 tracking-tighter tabular-nums">LKR {item.netAmount?.toLocaleString()}</p>
                        </td>
                        <td className="px-10 py-7">
                          <div className="flex justify-center">
                            <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                {item.status === 'paid' ? 'Authorized' : 'Pending'}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-7 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400">
                            <button onClick={() => { setSelectedSalary(item); setIsViewOpen(true); }} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 hover:text-primary rounded-xl transition-all" title="View Breakdown"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => toggleStatus(item)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${item.status === 'paid' ? 'text-emerald-500 hover:bg-emerald-50' : 'hover:bg-slate-100'}`} title="Toggle Authorization"><CheckCircle className="w-4 h-4" /></button>
                            
                            {item.status === 'paid' && (
                                <>
                                    <button onClick={async () => await generateSalaryPDF(item)} className="w-10 h-10 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all" title="Download Invoice PDF"><FileText className="w-4 h-4" /></button>
                                    <button onClick={() => handleWhatsAppShare(item)} className="w-10 h-10 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all" title="Share via WhatsApp"><MessageCircle className="w-4 h-4" /></button>
                                </>
                            )}

                            <button onClick={() => { setSelectedSalary(item); setIsDeleteOpen(true); setSalaryToDelete(item.id); }} className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all" title="Purge Record"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="px-10 py-32 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No payroll segments match this criteria.</td></tr>
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
