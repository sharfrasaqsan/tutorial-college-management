"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where, writeBatch, doc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  GraduationCap, 
  ArrowRight, 
  Users, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  History,
  Info
} from "lucide-react";
import { Grade, Student } from "@/types/models";
import toast from "react-hot-toast";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function PromotionPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [nextGradeId, setNextGradeId] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  useEffect(() => {
    async function loadData() {
      try {
        const gradeSnap = await getDocs(query(collection(db, "grades"), where("status", "==", "active")));
        const gradesList = gradeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade));
        // Sort grades by name/level to help mapping
        setGrades(gradesList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
      } catch (error) {
        console.error("Error loading grades:", error);
        toast.error("Failed to load institutional data.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function getCount() {
      if (!selectedGradeId) {
        setStudentCount(0);
        return;
      }
      try {
        const q = query(collection(db, "students"), where("gradeId", "==", selectedGradeId), where("status", "==", "active"));
        const snap = await getDocs(q);
        setStudentCount(snap.size);

        // Suggest next grade
        const currentIdx = grades.findIndex(g => g.id === selectedGradeId);
        if (currentIdx !== -1 && currentIdx < grades.length - 1) {
          setNextGradeId(grades[currentIdx + 1].id);
        } else {
          setNextGradeId("alumni");
        }
      } catch (error) {
        console.error("Count error:", error);
      }
    }
    getCount();
  }, [selectedGradeId, grades]);

  const handlePromotion = async () => {
    if (!selectedGradeId) return;
    
    setProcessing(true);
    setIsConfirmOpen(false);
    
    try {
      const batch = writeBatch(db);
      const studentQ = query(collection(db, "students"), where("gradeId", "==", selectedGradeId), where("status", "==", "active"));
      const studentsSnap = await getDocs(studentQ);
      
      const sourceGrade = grades.find(g => g.id === selectedGradeId);
      const targetGrade = nextGradeId === "alumni" ? { name: "Alumni", id: "alumni" } : grades.find(g => g.id === nextGradeId);

      if (!sourceGrade || !targetGrade) throw new Error("Invalid grade mapping");

      studentsSnap.docs.forEach((sDoc) => {
        const studentRef = doc(db, "students", sDoc.id);
        if (nextGradeId === "alumni") {
          batch.update(studentRef, {
            status: "inactive",
            updatedAt: serverTimestamp(),
            promotionHistory: (sDoc.data().promotionHistory || []).concat({
               from: sourceGrade.name,
               to: "Alumni",
               date: new Date().toISOString()
            })
          });
        } else {
          batch.update(studentRef, {
            grade: targetGrade.name,
            gradeId: targetGrade.id,
            academicYear: nextYear,
            updatedAt: serverTimestamp(),
            // Important: We DON'T clear enrolledClasses as per user's request to handle overlapping sessions
            promotionHistory: (sDoc.data().promotionHistory || []).concat({
               from: sourceGrade.name,
               to: targetGrade.name,
               date: new Date().toISOString()
            })
          });
        }
      });

      // Update counters for grades
      batch.update(doc(db, "grades", sourceGrade.id), { studentCount: Math.max(0, (sourceGrade.studentCount || 0) - studentsSnap.size) });
      if (nextGradeId !== "alumni") {
        const tgtGrade = targetGrade as Grade;
        batch.update(doc(db, "grades", tgtGrade.id), { studentCount: (tgtGrade.studentCount || 0) + studentsSnap.size });
      }

      await batch.commit();
      toast.success(`Promotion successful: ${studentsSnap.size} students moved to ${targetGrade.name}.`);
      setSelectedGradeId("");
      setNextGradeId("");
    } catch (error) {
      console.error("Promotion Error:", error);
      toast.error("Process interrupted. See logs for details.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
             <GraduationCap className="w-8 h-8 text-indigo-600" /> Academic Year Promotion
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest leading-none">
            Institutional Lifecycle Management • {currentYear} → {nextYear}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Interface */}
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                     <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                     <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">Promotion Engine</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Batch student migration</p>
                  </div>
               </div>
               <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{currentYear} Cycle</span>
               </div>
            </div>

            <div className="p-10 space-y-10">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative">
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Source Grade (2026)</label>
                     <div className="relative group">
                        <Users className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        <select 
                          value={selectedGradeId}
                          onChange={(e) => setSelectedGradeId(e.target.value)}
                          className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all appearance-none"
                        >
                           <option value="">Select current grade...</option>
                           {grades.map(g => (
                             <option key={g.id} value={g.id}>{g.name} ({g.studentCount || 0} Students)</option>
                           ))}
                        </select>
                        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                     </div>
                     {selectedGradeId && (
                       <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg inline-block">
                         {studentCount} Students identified for upgrade
                       </p>
                     )}
                  </div>

                  <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                     <div className="w-10 h-10 bg-white border border-slate-100 rounded-full shadow-lg flex items-center justify-center text-indigo-600">
                        <ArrowRight className="w-5 h-5" />
                     </div>
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Target Grade (2027)</label>
                     <div className="relative group">
                        <GraduationCap className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
                        <select 
                          value={nextGradeId}
                          onChange={(e) => setNextGradeId(e.target.value)}
                          className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-600/5 transition-all appearance-none"
                        >
                           <option value="">Target Destination...</option>
                           {grades.map(g => (
                             <option key={g.id} value={g.id}>{g.name}</option>
                           ))}
                           <option value="alumni" className="text-rose-600 font-black italic">Archive as Alumni (Completed)</option>
                        </select>
                        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                     </div>
                  </div>
               </div>

               <div className="p-8 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 group">
                  <div className="flex items-start gap-5">
                     <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-emerald-400" />
                     </div>
                     <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-white mb-2 underline decoration-indigo-500 decoration-2 underline-offset-8">Processing Rules</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                           The system will update student grade levels but will **NOT** remove them from existing classes to handle overlapping sessions as requested. 
                           Academic year focus for students will shift to **{nextYear}**.
                        </p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setIsConfirmOpen(true)}
                    disabled={!selectedGradeId || !nextGradeId || processing || studentCount === 0}
                    className="px-10 py-5 bg-white text-slate-900 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-emerald-400 hover:text-white transition-all shadow-xl disabled:opacity-30 disabled:grayscale"
                  >
                    {processing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Run Promotion"}
                  </button>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 space-y-4 shadow-sm">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                   <ChevronRight className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm italic">"Why no auto-archive?"</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  We built this with your logic: students move up, but their current classes stay active until the teacher finishes the syllabus. This prevents deleting progress for classes ending in Feb 2027.
                </p>
             </div>
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 space-y-4 shadow-sm">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                   <History className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm italic">Promotion History</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Every student now has a hidden "Promotion History" log. If you accidentally move a student, we can trace exactly when and where they were moved from.
                </p>
             </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-8">
           <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-8">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-50 pb-4">Yearly Statistics</h4>
              
              <div className="space-y-6">
                 {grades.slice(0, 5).map(g => (
                    <div key={g.id} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                          <p className="text-xs font-bold text-slate-600">{g.name}</p>
                       </div>
                       <span className="text-[10px] font-black text-slate-400 px-2 py-0.5 bg-slate-50 rounded-lg">{g.studentCount || 0}</span>
                    </div>
                 ))}
                 <button className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all">View Full grade Analytics</button>
              </div>
           </div>

           <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white space-y-6 relative overflow-hidden shadow-2xl shadow-indigo-100">
              <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
              <Info className="w-8 h-8 text-white/40" />
              <h4 className="text-lg font-bold tracking-tight">System Recommendation</h4>
              <p className="text-xs text-indigo-100 leading-relaxed font-medium">
                We recommend running promotions by **Grade Category** (e.g., Juniors first, then O/L batch). 
                Always ensure current month salaries are settled before moving students.
              </p>
              <div className="pt-4">
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-200 bg-white/10 px-4 py-2 rounded-xl inline-block">
                    <ShieldCheck className="w-3.5 h-3.5" /> Data Safe Mode Active
                 </div>
              </div>
           </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handlePromotion}
        loading={processing}
        title="Institutional Batch Promotion"
        message={`This will move ${studentCount} students from ${grades.find(g => g.id === selectedGradeId)?.name} to ${nextGradeId === "alumni" ? "Alumni" : grades.find(g => g.id === nextGradeId)?.name}. 
        All current class enrollments will be preserved as per cross-year session requirements.`}
      />
    </div>
  );
}
