"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DollarSign, Search, Filter, Download, CreditCard, User, AlertCircle, CheckCircle, Printer, Trash2, Eye } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Salary } from "@/types/models";
import SalaryProcessModal from "@/components/admin/SalaryProcessModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { doc, updateDoc, deleteDoc, where } from "firebase/firestore";
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

  // Actions states
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [salaryToDelete, setSalaryToDelete] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [salarySnap, teacherSnap] = await Promise.all([
        getDocs(query(collection(db, "salaries"), orderBy("month", "desc"))),
        getDocs(query(collection(db, "teachers"), where("status", "==", "active")))
      ]);
      setSalaries(salarySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
      setActiveTeachersCount(teacherSnap.size);
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
      await updateDoc(doc(db, "salaries", item.id), { status: newStatus });
      toast.success(newStatus === 'paid' ? "Salary marked as settled." : "Salary reverted to pending.");
      loadData();
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const confirmDelete = (id: string) => {
    setSalaryToDelete(id);
    setIsDeleteOpen(id !== null);
  };

  const handleDelete = async () => {
    if (!salaryToDelete) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "salaries", salaryToDelete));
      toast.success("Payroll record purged.");
      setIsDeleteOpen(false);
      setSalaryToDelete(null);
      loadData();
    } catch {
      toast.error("Deletion failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = (item: Salary) => {
    toast.success(`Generating payslip for ${item.teacherName}...`);
    // Logic for PDF generation can be added later
  };

  const totalPayout = salaries.reduce((sum, s) => s.status === 'paid' ? sum + (s.netAmount || 0) : sum, 0);
  const pendingCount = salaries.filter(s => s.status === 'pending').length;

  const filteredSalaries = salaries.filter(s => {
    const matchesSearch = s.teacherName?.toLowerCase().includes(searchTerm.toLowerCase());
    const [sYear, sMonth] = s.month.split('-');
    const matchesYear = filterYear === "" || sYear === filterYear;
    const matchesMonth = filterMonth === "" || sMonth === filterMonth;
    return matchesSearch && matchesYear && matchesMonth;
  });

  const availableYears = Array.from(new Set(salaries.map(s => s.month.split('-')[0]))).sort((a, b) => b.localeCompare(a));


  return (
    <div className="space-y-6">
      {/* Institutional Financial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1.5">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-4 group">
                <div className="bg-primary p-2.5 rounded-[1.25rem] shadow-xl shadow-primary/10 group-hover:rotate-6 transition-transform duration-500">
                    <DollarSign className="w-7 h-7 text-white" />
                </div>
                Salary Dashboard
            </h2>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Live payroll management and fiscal oversight</p>
        </div>
        <div className="flex items-center gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm uppercase tracking-widest hover:border-primary/20 group">
                <Download className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" /> Export Data
            </button>
            <button 
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-3 bg-primary text-white rounded-2xl text-[10px] font-black hover:bg-primary-dark transition-all flex items-center gap-2.5 shadow-xl shadow-primary/20 uppercase tracking-widest group"
            >
                <CreditCard className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" /> Process Salary
            </button>
        </div>
      </div>

      <SalaryProcessModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadData} 
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={actionLoading}
        title="Purge Payroll Record"
        message="This will permanently delete the calculated salary record. You will need to re-process the payroll if this was a mistake."
      />

      {/* View Breakdown Modal */}
      <Modal 
        isOpen={isViewOpen} 
        onClose={() => setIsViewOpen(false)} 
        title={`Earnings Breakdown: ${selectedSalary?.teacherName}`}
      >
        <div className="space-y-4">
           <div className="flex justify-between items-end p-4 bg-slate-50 rounded-2xl border border-slate-100">
             <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cycle</p>
                <p className="text-sm font-bold text-slate-800">{selectedSalary?.month}</p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Net Payable</p>
                <p className="text-xl font-black text-primary">LKR {selectedSalary?.netAmount?.toLocaleString()}</p>
             </div>
           </div>

           <div className="rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3 text-center">Sessions</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSalary?.breakdown?.map((b, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium">{b.className}</td>
                      <td className="px-4 py-3 text-center">{b.sessionsConducted} / 8</td>
                      <td className="px-4 py-3 text-right font-bold">LKR {b.finalPayout?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
           <button onClick={() => setIsViewOpen(false)} className="w-full py-3 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-900 transition-all">Close Review</button>
        </div>
      </Modal>

      {/* Glassmorphism Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl hover:translate-y-[-4px] transition-all duration-500 group relative overflow-hidden h-44">
           <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
              <DollarSign className="w-full h-full text-primary" />
           </div>
           <div className="flex justify-between items-start">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
                <DollarSign className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">Total Payouts</span>
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total for this month</p>
              {loading ? (
                <Skeleton variant="text" width="160px" height="32px" />
              ) : (
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">LKR {totalPayout.toLocaleString()}</h3>
              )}
           </div>
        </div>
        
        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-xl hover:translate-y-[-4px] transition-all duration-500 group relative overflow-hidden h-44">
           <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
              <AlertCircle className="w-full h-full text-orange-500" />
           </div>
           <div className="flex justify-between items-start">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
                <AlertCircle className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">Unpaid</span>
           </div>
           <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Pending payments</p>
              {loading ? (
                <Skeleton variant="text" width="120px" height="32px" />
              ) : (
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{String(pendingCount).padStart(2, '0')} Salaries</h3>
              )}
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col shadow-2xl shadow-slate-900/10 justify-between hover:translate-y-[-4px] transition-all duration-500 group relative overflow-hidden h-44">
           <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12 group-hover:bg-primary/20 transition-all duration-700"></div>
           <div className="flex justify-between items-start relative z-10">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-primary shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
                <User className="w-7 h-7" />
              </div>
              <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/40">Total Staff</span>
           </div>
           <div className="relative z-10">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5 font-black flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Faculty
              </p>
              {loading ? (
                <Skeleton variant="text" width="120px" height="32px" className="bg-white/5" />
              ) : (
                <h3 className="text-2xl font-black text-white tracking-tight leading-none">{activeTeachersCount} Teachers</h3>
              )}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden flex flex-col group/ledger hover:border-primary/20 transition-all duration-700">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30 gap-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover/ledger:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search faculty members..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-8 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.1em] focus:ring-4 focus:ring-primary/5 transition-all shadow-inner placeholder:text-slate-300"
            />
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-inner">
                <select 
                   value={filterYear}
                   onChange={(e) => setFilterYear(e.target.value)}
                   className="bg-transparent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none"
                >
                   <option value="">All Years</option>
                   {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="w-px h-6 bg-slate-100 my-auto"></div>
                <select 
                   value={filterMonth}
                   onChange={(e) => setFilterMonth(e.target.value)}
                   className="bg-transparent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none"
                >
                   <option value="">All Months</option>
                   {[
                      { v: "01", n: "Jan" }, { v: "02", n: "Feb" }, { v: "03", n: "Mar" }, 
                      { v: "04", n: "Apr" }, { v: "05", n: "May" }, { v: "06", n: "Jun" },
                      { v: "07", n: "Jul" }, { v: "08", n: "Aug" }, { v: "09", n: "Sep" },
                      { v: "10", n: "Oct" }, { v: "11", n: "Nov" }, { v: "12", n: "Dec" }
                   ].map(m => <option key={m.v} value={m.v}>{m.n}</option>)}
                </select>
             </div>
             <button 
                onClick={() => {
                   setFilterYear("");
                   setFilterMonth("");
                   setSearchTerm("");
                }}
                className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all text-slate-400 hover:text-primary shadow-sm"
             >
                <Filter className="w-5 h-5" />
             </button>
          </div>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] border-b border-slate-50">
              <tr>
                <th className="px-10 py-6">Faculty Identity</th>
                <th className="px-10 py-6">Ledger Cycle</th>
                <th className="px-10 py-6">Processed On</th>
                <th className="px-10 py-6 text-right">Base Earning</th>
                <th className="px-10 py-6 text-right">Net Settlement</th>
                <th className="px-10 py-6 text-center">Status</th>
                <th className="px-10 py-6 text-right">Operational Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse bg-white">
                    <td className="px-10 py-6" colSpan={6}><div className="h-10 bg-slate-50 rounded-2xl w-full"></div></td>
                  </tr>
                ))
              ) : (
                filteredSalaries.length > 0 ? filteredSalaries.map((item) => (
                  <tr key={item.id} className="hover:bg-primary/5 transition-all duration-500 group/row">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center font-black group-hover/row:bg-primary group-hover/row:text-white transition-all shadow-inner text-sm uppercase">
                          {item.teacherName?.charAt(0)}
                        </div>
                        <div>
                            <p className="font-black text-slate-800 tracking-tight text-sm group-hover/row:text-primary transition-colors">{item.teacherName}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Fac-0{item.teacherId?.slice(-3)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                        <span className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover/row:border-primary/20 transition-all">
                            {formatMonthYear(item.month)}
                        </span>
                    </td>
                    <td className="px-10 py-6 font-medium text-slate-400 uppercase tracking-widest tabular-nums">
                        {formatDate(item.createdAt)}
                    </td>
                    <td className="px-10 py-6 text-right font-bold text-slate-400 tabular-nums uppercase">LKR {item.basicAmount?.toLocaleString()}</td>
                    <td className="px-10 py-6 text-right">
                        <p className="text-xl font-black text-primary tracking-tighter tabular-nums">LKR {item.netAmount?.toLocaleString()}</p>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex justify-center">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm' : 'bg-orange-50 text-orange-600 border-orange-100 shadow-sm'}`}>
                            {item.status === 'paid' ? 'Settled' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button 
                          onClick={() => {
                            setSelectedSalary(item);
                            setIsViewOpen(true);
                          }}
                          className="w-10 h-10 flex items-center justify-center hover:bg-white hover:text-primary hover:border-primary/10 border border-transparent rounded-2xl transition-all shadow-hover"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => toggleStatus(item)}
                          className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all border border-transparent hover:bg-white ${item.status === 'paid' ? 'text-emerald-500 hover:border-emerald-100' : 'text-slate-400 hover:text-emerald-600 hover:border-emerald-100'}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handlePrint(item)}
                          className="w-10 h-10 flex items-center justify-center hover:bg-white hover:text-blue-500 hover:border-blue-100 border border-transparent rounded-2xl transition-all shadow-hover"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(item.id)}
                          className="w-10 h-10 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 border border-transparent rounded-2xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-10 py-32 text-center">
                       <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-200 mx-auto mb-6">
                            <DollarSign className="w-10 h-10" />
                       </div>
                       <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No payroll segments match this query.</p>
                       <button onClick={() => setSearchTerm("")} className="mt-4 text-primary font-black uppercase tracking-widest text-[9px] hover:underline transition-all">Clear All Filters</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
