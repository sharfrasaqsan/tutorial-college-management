"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditCard, ChevronRight, Calendar, Receipt, Users, GraduationCap, BookOpen, User, CheckCircle2, History, ArrowLeft, Loader2 } from "lucide-react";
import { Student, Class, Grade, Payment } from "@/types/models";
import toast from "react-hot-toast";
import { generateStudentPaymentPDF } from "@/lib/pdf-generator";

export default function RecordPaymentPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Selection State
  const [step, setStep] = useState(1);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form State
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    month: "April",
    method: "cash",
    description: "Monthly School Fee"
  });

  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];

  // 1. Load Initial Data (Grades)
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const gradeSnap = await getDocs(query(collection(db, "grades"), orderBy("name", "asc")));
        setGrades(gradeSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));
      } catch (error) {
        console.error("Error loading grades", error);
        toast.error("Failed to load grade registry");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 2. Fetch Classes when Grade changes
  const handleGradeSelect = async (gradeId: string) => {
    setSelectedGradeId(gradeId);
    setLoading(true);
    try {
      const q = query(collection(db, "classes"), where("gradeId", "==", gradeId));
      const snap = await getDocs(q);
      const fetchedClasses = snap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      setClasses(fetchedClasses);
      setStep(2);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch Students when Class changes
  const handleClassSelect = async (classId: string) => {
    setSelectedClassId(classId);
    setLoading(true);
    try {
      const q = query(collection(db, "students"), where("enrolledClasses", "array-contains", classId));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
      
      // Auto-set amount if class has monthly fee
      const cls = classes.find(c => c.id === classId);
      if (cls) setPaymentData(prev => ({ ...prev, amount: cls.monthlyFee || 0 }));
      
      setStep(3);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (std: Student) => {
    setSelectedStudent(std);
    setStep(4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedClassId || !paymentData.amount) return;

    setSubmitting(true);
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      
      const record = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        classId: selectedClassId,
        className: selectedClass?.name || "",
        subject: selectedClass?.subject || "",
        amount: Number(paymentData.amount),
        month: paymentData.month.toLowerCase(),
        method: paymentData.method,
        status: 'paid',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "payments"), record);
      
      toast.success("Transaction verified successfully!");
      
      // Generate High-Fidelity PDF
      const finalPayment = { id: docRef.id, ...record, createdAt: new Date() } as any;
      await generateStudentPaymentPDF(finalPayment, selectedStudent.name, selectedStudent.studentId);

      // Reset
      setStep(1);
      setSelectedGradeId("");
      setSelectedClassId("");
      setSelectedStudent(null);
    } catch (error) {
      console.error("Critical Payment Error:", error);
      toast.error("Process failed. Please verify credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 mt-6">
      
      {/* 🚀 Hierarchical Terminal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${step === 4 ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-primary text-white shadow-primary/20'}`}>
                <Receipt className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fee Collection Terminal</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Status: Institutional Node</span>
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></span>
              </div>
            </div>
        </div>

        {/* Dynamic Breadcrumbs */}
        <div className="flex items-center gap-3">
            {[
                { s: 1, label: 'Grade', active: !!selectedGradeId },
                { s: 2, label: 'Class', active: !!selectedClassId },
                { s: 3, label: 'Student', active: !!selectedStudent },
                { s: 4, label: 'Payment', active: step === 4 },
            ].map((node, i) => (
                <div key={i} className="flex items-center gap-3">
                    <div className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${step === node.s ? 'scale-110 opacity-100' : 'opacity-40'}`}>
                        <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${node.active ? 'bg-emerald-500 border-emerald-500 text-white' : step === node.s ? 'border-primary text-primary' : 'border-slate-200 text-slate-300'}`}>
                            {node.active ? <CheckCircle2 className="w-4 h-4" /> : node.s}
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest">{node.label}</span>
                    </div>
                    {i < 3 && <div className="w-4 h-[2px] bg-slate-100 mt-[-10px]"></div>}
                </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Selection Area */}
        <div className="lg:col-span-8 space-y-8">
            
            {/* Step 1: Grade Selection */}
            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Step 1: Select Academic Grade</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {loading ? (
                            [1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-2xl bg-slate-50 animate-pulse border border-slate-100"></div>)
                        ) : grades.map(g => (
                            <button
                                key={g.id}
                                onClick={() => handleGradeSelect(g.id)}
                                className="p-6 rounded-2xl border-2 border-slate-100 bg-white hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all group flex flex-col items-center text-center gap-3"
                            >
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                                    <GraduationCap className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">{g.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{g.studentCount || 0} Students</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: Class Selection */}
            {step === 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6 flex items-center gap-4">
                        <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Step 2: Select Active Class</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {loading ? (
                            [1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-50 animate-pulse border border-slate-100"></div>)
                        ) : classes.length > 0 ? classes.map(cls => (
                            <button
                                key={cls.id}
                                onClick={() => handleClassSelect(cls.id)}
                                className="p-6 rounded-2xl border-2 border-slate-100 bg-white hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group flex items-start gap-4 text-left"
                            >
                                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1.5">{cls.subject}</p>
                                    <p className="text-base font-bold text-slate-800 leading-tight mb-1">{cls.name}</p>
                                    <div className="flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5 text-slate-300" />
                                        <span className="text-[11px] font-bold text-slate-500">{cls.studentCount || 0} Enrolled</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-emerald-500 self-center" />
                            </button>
                        )) : (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">No classes found for this grade</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 3: Student Selection */}
            {step === 3 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="mb-6 flex items-center gap-4">
                        <button onClick={() => setStep(2)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Step 3: Select Student to Pay</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {loading ? (
                            [1,2,3,4,5,6].map(i => <div key={i} className="h-20 rounded-2xl bg-slate-50 animate-pulse border border-slate-100"></div>)
                        ) : students.length > 0 ? students.map(std => (
                            <button
                                key={std.id}
                                onClick={() => handleStudentSelect(std)}
                                className="p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all group flex items-center gap-4 text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all font-bold text-sm">
                                    {std.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">{std.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">ID: {std.studentId}</p>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                    <ArrowLeft className="w-4 h-4 text-primary rotate-180" />
                                </div>
                            </button>
                        )) : (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">No students found in this class</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Step 4: Final Form */}
            {step === 4 && selectedStudent && (
                <div className="animate-in zoom-in-95 duration-500">
                    <div className="mb-8 flex items-center gap-4">
                        <button onClick={() => setStep(3)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft className="w-5 h-5" /></button>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Step 4: Audit & Verify Payment</h4>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Student Review Card */}
                        <div className="p-8 rounded-[2rem] bg-emerald-50 border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                             <div className="flex items-center gap-6 relative z-10">
                                <div className="w-20 h-20 rounded-full bg-white border-4 border-emerald-200 flex items-center justify-center text-emerald-600 text-2xl font-black shadow-lg">
                                    {selectedStudent.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">{selectedStudent.name}</h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase bg-white px-2 py-0.5 rounded-full border border-emerald-100">Verified ID: {selectedStudent.studentId}</span>
                                        <span className="text-[11px] font-semibold text-slate-400 italic">Enrolled in {classes.find(c => c.id === selectedClassId)?.name}</span>
                                    </div>
                                </div>
                             </div>
                             <div className="p-4 bg-white/60 backdrop-blur rounded-2xl border border-white/80 shadow-sm relative z-10 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Standard Tuition</p>
                                <p className="text-lg font-black text-slate-800 leading-none">LKR {classes.find(c => c.id === selectedClassId)?.monthlyFee?.toLocaleString()}</p>
                             </div>
                             
                             {/* Faded Background Pattern */}
                             <History className="absolute right-[-20px] bottom-[-20px] w-40 h-40 text-emerald-100 rotate-12" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-3">
                                <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Academic Month</label>
                                <div className="relative group">
                                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-primary transition-all" />
                                    <select 
                                        value={paymentData.month}
                                        onChange={(e) => setPaymentData({ ...paymentData, month: e.target.value })}
                                        className="w-full pl-14 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold uppercase tracking-widest outline-none focus:border-primary focus:ring-8 focus:ring-primary/5 transition-all appearance-none"
                                        required
                                    >
                                        {months.map(m => (
                                            <option key={m} value={m}>{m} 2026</option>
                                        ))}
                                    </select>
                                </div>
                             </div>
                             <div className="space-y-3">
                                <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Verified Amount (LKR)</label>
                                <div className="relative group">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-focus-within:text-primary transition-all">Rs.</span>
                                    <input 
                                        type="number"
                                        value={paymentData.amount}
                                        onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-black outline-none focus:border-primary focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all shadow-inner"
                                        required
                                    />
                                </div>
                             </div>
                        </div>

                        <div className="space-y-3">
                             <label className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Payment Channel</label>
                             <div className="grid grid-cols-3 gap-4">
                                {['cash', 'card', 'bank'].map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setPaymentData({ ...paymentData, method: m })}
                                        className={`py-5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden shadow-sm ${paymentData.method === m ? 'border-slate-900 bg-slate-900 text-white shadow-xl translate-y-[-2px]' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                                    >
                                        {m}
                                        {paymentData.method === m && <div className="absolute top-1 right-2"><CheckCircle2 className="w-3 h-3 text-emerald-400" /></div>}
                                    </button>
                                ))}
                             </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={submitting}
                            className="w-full py-5 bg-primary text-white rounded-3xl text-sm font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:bg-primary/95 transition-all flex items-center justify-center gap-4 relative overflow-hidden group active:scale-[0.98]"
                        >
                            {submitting ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                    Finalize Transaction
                                </>
                            )}
                            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                        </button>
                    </form>
                </div>
            )}
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-4 space-y-6">
            <div className="p-8 rounded-[2.5rem] bg-slate-900 text-white space-y-8 relative overflow-hidden shadow-2xl">
                <div className="relative z-10 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Transaction Info</p>
                    <h5 className="text-xl font-bold tracking-tight">Vault Protocol</h5>
                </div>
                
                <div className="space-y-6 relative z-10">
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                        <History className="w-5 h-5 text-primary-light mt-1" />
                        <div>
                            <p className="text-xs font-bold text-slate-100">Auto-Receipts</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">System generates high-fidelity PDF receipts immediately upon verification. Ensure local storage is enabled.</p>
                        </div>
                    </div>
                </div>

                {/* Progress Visualizer */}
                <div className="pt-8 space-y-4 relative z-10 border-t border-white/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Node Completion</p>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${(step/4)*100}%` }}></div>
                    </div>
                </div>

                <div className="absolute top-[-20px] right-[-20px] w-48 h-48 bg-primary/20 rounded-full blur-[60px]"></div>
            </div>

            <div className="p-8 rounded-[2.5rem] border border-slate-100 bg-slate-50/50 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Logs</p>
                <div className="space-y-4">
                    {[
                        { label: 'Security Layer', val: 'Active', color: 'text-emerald-500' },
                        { label: 'Cloud Sync', val: 'Operational', color: 'text-emerald-500' },
                        { label: 'Latency', val: '14ms', color: 'text-slate-500' },
                    ].map((log, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500">{log.label}</span>
                            <span className={`text-[10px] font-black uppercase ${log.color}`}>{log.val}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
