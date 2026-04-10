"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where, doc, setDoc, serverTimestamp, orderBy, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, TrendingUp, AlertCircle, CheckCircle2, Calculator } from "lucide-react";
import Modal from "@/components/ui/Modal";
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
  perSessionRate: number;
  finalPayout: number;
}

export default function SalaryProcessModal({ isOpen, onClose, onSuccess }: SalaryProcessModalProps) {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  
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
    if (!selectedTeacherId || !selectedMonth) return;
    
    setCalculating(true);
    setEarningsDetails([]);
    try {
      const classQ = query(collection(db, "classes"), where("teacherId", "==", selectedTeacherId), where("status", "==", "active"));
      const classSnap = await getDocs(classQ);
      const teacherClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));

      if (teacherClasses.length === 0) {
        toast.error("No active classes found for this instructor.");
        setCalculating(false);
        return;
      }

      const details: ClassEarnings[] = teacherClasses.map(cls => {
        const studentCount = cls.studentCount || 0;
        const monthlyFee = cls.monthlyFee || 0;
        const sessionsConducted = cls.sessionsSinceLastPayment || 0;
        const totalMonthlyRevenue = studentCount * monthlyFee;
        const perSessionRate = totalMonthlyRevenue / 8;
        const finalPayout = perSessionRate * sessionsConducted;

        return {
          classId: cls.id,
          className: cls.name,
          monthlyFee,
          studentCount,
          totalMonthlyRevenue,
          sessionsConducted,
          perSessionRate,
          finalPayout: Math.round(finalPayout)
        };
      });

      setEarningsDetails(details);
      setTotalNet(details.reduce((sum, item) => sum + item.finalPayout, 0));
    } catch (error) {
      console.error("Calculation error:", error);
      toast.error("Salary calculation engine stalled.");
    } finally {
      setCalculating(false);
    }
  };

  const updateSessionCount = (classId: string, count: number) => {
    const updatedDetails = earningsDetails.map(item => {
      if (item.classId === classId) {
        const finalPayout = item.perSessionRate * count;
        return { ...item, sessionsConducted: count, finalPayout: Math.round(finalPayout) };
      }
      return item;
    });
    setEarningsDetails(updatedDetails);
    setTotalNet(updatedDetails.reduce((sum, item) => sum + item.finalPayout, 0));
  };

  const processPayment = async () => {
    if (earningsDetails.length === 0 || !selectedTeacherId) return;
    
    setLoading(true);
    try {
      const teacher = teachers.find(t => t.id === selectedTeacherId);
      const batch = writeBatch(db);
      const salaryId = `${selectedTeacherId}-${selectedMonth}`;
      const salaryRef = doc(collection(db, "salaries"), salaryId);
      
      const salaryDoc = {
        teacherId: selectedTeacherId,
        teacherName: teacher?.name || "Unknown",
        month: selectedMonth,
        status: "pending",
        basicAmount: totalNet, 
        netAmount: totalNet,
        breakdown: earningsDetails,
        createdAt: serverTimestamp(),
        processedAt: serverTimestamp(),
        paymentMethod: "Bank Transfer",
      };

      batch.set(salaryRef, salaryDoc);
      
      // Reset sessionsSinceLastPayment for the processed classes
      earningsDetails.forEach(item => {
        if (item.sessionsConducted > 0) {
            batch.update(doc(db, "classes", item.classId), {
                sessionsSinceLastPayment: 0
            });
        }
      });

      await batch.commit();
      
      toast.success(`Payroll generated for ${teacher?.name} (${selectedMonth})`);
      onSuccess();
      onClose();
    } catch (error) {
       console.error("Payroll error:", error);
       toast.error("Failed to finalize payroll document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Institutional Payroll Engine">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Select Faculty Member</label>
              <select 
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-slate-700"
              >
                <option value="">Choose Instructor</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.teacherId})</option>)}
              </select>
           </div>
           <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Payroll Cycle</label>
              <input 
                 type="month"
                 value={selectedMonth}
                 onChange={(e) => setSelectedMonth(e.target.value)}
                 className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-slate-700"
              />
           </div>
        </div>

        <button 
          onClick={calculateSalary}
          disabled={calculating || !selectedTeacherId}
          className="w-full py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 disabled:opacity-50"
        >
           {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4" /> Initialize Earnings Preview</>}
        </button>

        {earningsDetails.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom duration-500">
             <div className="flex items-center justify-between px-2">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-emerald-500" /> Manual Adjustments (8-Session Rule)
                </h4>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Net Payable</p>
                   <p className="text-xl font-black text-primary">LKR {totalNet.toLocaleString()}</p>
                </div>
             </div>

             <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-[11px] text-left">
                   <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <tr>
                         <th className="px-4 py-3">Academic Session</th>
                         <th className="px-4 py-3 text-center">Enrollment</th>
                         <th className="px-4 py-3 text-center">Sessions Held</th>
                         <th className="px-4 py-3 text-right">Payout</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {earningsDetails.map((item) => (
                        <tr key={item.classId}>
                           <td className="px-4 py-3 font-bold text-slate-700">{item.className}</td>
                           <td className="px-4 py-3 text-center font-medium text-slate-500">{item.studentCount} Students</td>
                           <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                min="0" 
                                value={item.sessionsConducted}
                                onChange={(e) => updateSessionCount(item.classId, parseInt(e.target.value) || 0)}
                                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-black text-primary focus:ring-2 focus:ring-primary/20 outline-none"
                              />
                           </td>
                           <td className="px-4 py-3 text-right font-black text-slate-800">LKR {item.finalPayout.toLocaleString()}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>

             <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                   <p className="text-xs font-bold text-amber-700">Administrative Flexibility</p>
                   <p className="text-[10px] text-amber-600/80 leading-relaxed font-medium">
                      Enter the actual number of sessions conducted for the month. 
                      The system will automatically apply the pro-rata rate based on the 8-session benchmark per class.
                   </p>
                </div>
             </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
           <button 
             onClick={onClose}
             className="px-6 py-2.5 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
           >
              Cancel
           </button>
           <button 
             onClick={processPayment}
             disabled={loading || earningsDetails.length === 0}
             className="px-8 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
           >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Authorize Payroll</>}
           </button>
        </div>
      </div>
    </Modal>
  );
}
