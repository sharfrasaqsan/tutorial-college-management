"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where, doc, serverTimestamp, orderBy, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Loader2, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Calculator, 
  X, 
  User, 
  Calendar, 
  ArrowRight, 
  CreditCard,
  History,
  ShieldCheck,
  Zap
} from "lucide-react";
import { Teacher, Class } from "@/types/models";
import toast from "react-hot-toast";

interface SalaryProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClassEarnings {
  classId: string;
  className: string;
  monthlyFee: number;
  studentCount: number;
  totalMonthlyRevenue: number;
  sessionsConducted: number;
  sessionsPerCycle: number;
  perSessionRate: number;
  finalPayout: number;
}

export default function SalaryProcessModal({ isOpen, onClose, onSuccess }: SalaryProcessModalProps) {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  
  const [activeTab, setActiveTab] = useState<'configuration' | 'settlement'>('configuration');
  const [earningsDetails, setEarningsDetails] = useState<ClassEarnings[]>([]);
  const [totalNet, setTotalNet] = useState(0);

  useEffect(() => {
    async function loadTeachers() {
      if (!isOpen) return;
      try {
        const q = query(collection(db, "teachers"), where("status", "==", "active"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher)));
      } catch (error) {
        console.error("Error loading teachers:", error);
      }
    }
    loadTeachers();
  }, [isOpen]);

  const calculateSalary = async () => {
    if (!selectedTeacherId || !selectedMonth) {
        toast.error("Please fill in all required items.");
        return;
    }
    
    setCalculating(true);
    setEarningsDetails([]);
    try {
      const classQ = query(collection(db, "classes"), where("teacherId", "==", selectedTeacherId), where("status", "==", "active"));
      const classSnap = await getDocs(classQ);
      const teacherClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));

      if (teacherClasses.length === 0) {
        toast.error("No active classes found for this teacher.");
        setCalculating(false);
        return;
      }

      const details: ClassEarnings[] = teacherClasses.map(cls => {
        const studentCount = cls.studentCount || 0;
        const monthlyFee = cls.monthlyFee || 0;
        const sessionsConducted = cls.sessionsSinceLastPayment || 0;
        const totalMonthlyRevenue = studentCount * monthlyFee;
        const cycleValue = cls.sessionsPerCycle || 8;
        const perSessionRate = cycleValue > 0 ? totalMonthlyRevenue / cycleValue : 0;
        const finalPayout = perSessionRate * sessionsConducted;

        return {
          classId: cls.id,
          className: cls.name,
          monthlyFee,
          studentCount,
          totalMonthlyRevenue,
          sessionsConducted,
          sessionsPerCycle: cycleValue,
          perSessionRate,
          finalPayout: Math.round(finalPayout)
        };
      });

      setEarningsDetails(details);
      setTotalNet(details.reduce((sum, item) => sum + item.finalPayout, 0));
      setActiveTab('settlement');
    } catch (error) {
      console.error("Calculation error:", error);
      toast.error("Payroll engine initialization failed.");
    } finally {
      setCalculating(false);
    }
  };

  const updateSessionCount = (classId: string, count: number) => {
    const updatedDetails = earningsDetails.map(item => {
      if (item.classId === classId) {
        const safeCount = Math.max(0, count);
        const finalPayout = item.perSessionRate * safeCount;
        return { ...item, sessionsConducted: safeCount, finalPayout: Math.round(finalPayout) };
      }
      return item;
    });
    setEarningsDetails(updatedDetails);
    setTotalNet(updatedDetails.reduce((sum, item) => sum + item.finalPayout, 0));
  };

  const processPayment = async (item: ClassEarnings) => {
    if (!selectedTeacherId) return;
    
    if (item.sessionsConducted <= 0) {
      toast.error("Invalid state: Zero sessions logged.");
      return;
    }
    
    setLoading(true);
    try {
      const teacher = teachers.find(t => t.id === selectedTeacherId);
      const batch = writeBatch(db);
      
      const salaryId = `${selectedTeacherId}-${item.classId}-${selectedMonth}-${Date.now()}`;
      const salaryRef = doc(db, "salaries", salaryId);
      
      const salaryDoc = {
        teacherId: selectedTeacherId,
        teacherName: teacher?.name || "Unknown",
        classId: item.classId,
        className: item.className,
        month: selectedMonth,
        status: "pending",
        sessionsConducted: item.sessionsConducted,
        sessionsPerCycle: item.sessionsPerCycle,
        monthlyFee: item.monthlyFee,
        studentCount: item.studentCount,
        totalMonthlyRevenue: item.totalMonthlyRevenue,
        perSessionRate: item.perSessionRate,
        basicAmount: item.finalPayout, 
        netAmount: item.finalPayout,
        createdAt: serverTimestamp(),
        processedAt: serverTimestamp(),
        paymentMethod: "Bank Transfer",
      };

      batch.set(salaryRef, salaryDoc);
      batch.update(doc(db, "classes", item.classId), {
        sessionsSinceLastPayment: increment(-(item.sessionsConducted))
      });

      const completionsQ = query(
        collection(db, "session_completions"),
        where("classId", "==", item.classId),
        where("teacherId", "==", selectedTeacherId)
      );
      const completionsSnap = await getDocs(completionsQ);
      completionsSnap.docs.forEach(compDoc => {
          batch.update(doc(db, "session_completions", compDoc.id), {
            isPaid: false,
            salaryId: salaryId
          });
      });

      await batch.commit();
      toast.success(`Payroll advice triggered: ${item.className}`);
      
      setEarningsDetails(prev => prev.filter(e => e.classId !== item.classId));
      onSuccess();
      
      if (earningsDetails.length <= 1) {
          onClose();
          setActiveTab('configuration');
      }
    } catch (error) {
       console.error("Payroll error:", error);
       toast.error("Critical: Settlement persistence failure.");
    } finally {
      setLoading(false);
    }
  };

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300">
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    <CreditCard className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        Institutional Payroll Terminal
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> AUTHORIZED ACCESS
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                             {selectedMonth || "CYCLE PENDING"}
                         </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Tabs */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['configuration', 'settlement'] as const).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    disabled={tab === 'settlement' && earningsDetails.length === 0}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize disabled:opacity-30 ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab === 'configuration' ? 'Details' : 'Review'}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all" />
                    )}
                </button>
            ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
          <div className="animate-in fade-in duration-500 pb-10">
            {activeTab === 'configuration' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <User className="w-3.5 h-3.5" /> Teacher Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Teacher</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                            <select 
                                value={selectedTeacherId}
                                onChange={(e) => setSelectedTeacherId(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-700 appearance-none shadow-sm"
                            >
                                <option value="">Select a Teacher</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.teacherId})</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Select Month</label>
                        <div className="relative group">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                            <input 
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-700 shadow-sm"
                            />
                        </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
                   <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-primary">
                         <Calculator className="w-6 h-6" />
                      </div>
                      <div>
                         <p className="text-sm font-bold text-slate-900">Calculate Payment</p>
                         <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Check sessions and class details</p>
                      </div>
                   </div>
                   <button 
                      onClick={calculateSalary}
                      disabled={calculating || !selectedTeacherId}
                      className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all flex items-center gap-3 shadow-xl shadow-slate-200 disabled:opacity-50"
                   >
                      {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 shadow-emerald-500" /> Run Calculation</>}
                   </button>
                </div>
              </div>
            )}

            {activeTab === 'settlement' && (
              <div className="max-w-4xl mx-auto space-y-10">
                <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                    <div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight">{selectedTeacher?.name}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Payment Review for {selectedMonth}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Amount</p>
                        <p className="text-2xl font-black text-primary tabular-nums">LKR {totalNet.toLocaleString()}</p>
                    </div>
                </div>

                <div className="space-y-6">
                  {earningsDetails.map((item) => (
                    <div key={item.classId} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group">
                       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                <TrendingUp className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-800">{item.className}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Fee: LKR {item.monthlyFee} × {item.studentCount} Students</p>
                             </div>
                          </div>
                           <div className="flex items-center gap-8">
                             <div className="text-center">
                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5">Sessions</p>
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    value={item.sessionsConducted}
                                    onChange={(e) => updateSessionCount(item.classId, parseInt(e.target.value) || 0)}
                                    className="w-14 h-9 bg-slate-50 border border-slate-100 rounded-xl text-center font-black text-primary focus:ring-4 focus:ring-primary/5 outline-none transition-all text-sm"
                                  />
                                  <span className="text-xs font-black text-slate-300">/ {item.sessionsPerCycle}</span>
                                </div>
                             </div>
                             
                             <div className="text-right min-w-[120px]">
                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Amount</p>
                                <p className="text-base font-black text-slate-800 tabular-nums">LKR {item.finalPayout.toLocaleString()}</p>
                             </div>


                             <button 
                                onClick={() => processPayment(item)}
                                disabled={loading || item.sessionsConducted <= 0}
                                className="w-12 h-12 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100 rounded-2xl flex items-center justify-center transition-all disabled:opacity-20"
                             >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-6 h-6" />}
                             </button>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>

                 <div className="p-6 bg-slate-900 rounded-[2.5rem] border border-slate-800 flex items-start gap-5 text-white">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                       <AlertCircle className="w-6 h-6 text-white/40" />
                    </div>
                    <div>
                       <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">Important Note</h4>
                       <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-medium">
                          The session count comes from the teacher's records. You can change it if needed. 
                          Paying will create a receipt and lock these sessions for this month.
                       </p>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                Protocol: Secure Fiscal Authorization v4.2
            </p>
            <div className="flex items-center gap-3">
                <button 
                    onClick={onClose}
                    className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                >
                    Discard Changes
                </button>
                <button 
                    onClick={calculateSalary}
                    disabled={activeTab === 'settlement' || !selectedTeacherId}
                    className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 shadow-xl shadow-slate-200"
                >
                    Initialize Settlement Pipeline <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
