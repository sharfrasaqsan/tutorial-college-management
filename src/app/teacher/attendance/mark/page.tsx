"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X, Users, CheckCircle2, ChevronLeft, Calendar, Loader2 } from "lucide-react";
import { Student, Class } from "@/types/models";
import toast from "react-hot-toast";

function MarkAttendanceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get("classId");

  const [classDetail, setClassDetail] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceData, setAttendanceData] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadData() {
      if (!classId) return;
      setLoading(true);
      try {
        // 1. Fetch Class
        const classRef = doc(db, "classes", classId);
        const classSnap = await getDoc(classRef);
        
        if (classSnap.exists()) {
          const classInfo = { id: classSnap.id, ...classSnap.data() } as Class;
          setClassDetail(classInfo);

          // 2. Fetch Students in the SAME GRADE
          // Assumption: All students in the grade of the class are eligible
          const q = query(collection(db, "students"), where("grade", "==", classInfo.grade));
          const studentSnap = await getDocs(q);
          const studentList = studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
          
          setStudents(studentList);
          
          // Initial state: everyone present
          const initialData: Record<string, boolean> = {};
          studentList.forEach(s => initialData[s.id] = true);
          setAttendanceData(initialData);
        }
      } catch (error) {
        console.error("Attendance Loading Error:", error);
        toast.error("Failed to load session participants.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [classId]);

  const toggleStatus = (id: string) => {
    setAttendanceData(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const markAll = (status: boolean) => {
    const newData: Record<string, boolean> = {};
    students.forEach(s => newData[s.id] = status);
    setAttendanceData(newData);
  };

  const handleSubmit = async () => {
    if (!classId || students.length === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "attendance"), {
        classId,
        className: classDetail?.name,
        teacherId: classDetail?.teacherId,
        date: new Date().toISOString().split('T')[0],
        records: attendanceData,
        createdAt: serverTimestamp()
      });
      toast.success("Registers updated successfully!");
      router.push("/teacher/attendance");
    } catch (error) {
       toast.error("Cloud sync failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex flex-col items-center justify-center h-[70vh]">
    <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Opening Secure Register...</p>
  </div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="p-2 border border-slate-200 rounded-xl hover:bg-white transition-all text-slate-500 flex items-center gap-2 text-xs font-bold"
        >
          <ChevronLeft className="w-4 h-4" /> Go Back
        </button>
        <div className="text-right">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{classDetail?.name}</h2>
            <p className="text-[10px] font-black uppercase text-indigo-600 flex items-center justify-end gap-1">
                <Calendar className="w-3 h-3" /> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-100/20 overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-8">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Category</p>
                    <p className="text-sm font-bold text-slate-700">{classDetail?.subject} - {classDetail?.grade}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Participants</p>
                    <p className="text-sm font-bold text-slate-700">{students.length} Total</p>
                 </div>
            </div>
            <div className="flex items-center gap-3">
                 <button onClick={() => markAll(true)} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">Mark All Present</button>
                 <button onClick={() => markAll(false)} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors">Absence All</button>
            </div>
        </div>

        <div className="p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {students.map((s) => (
                    <button 
                        key={s.id}
                        onClick={() => toggleStatus(s.id)}
                        className={`group p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${attendanceData[s.id] ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02]' : 'bg-slate-50 border-transparent opacity-60'}`}
                    >
                        <div className="flex items-center gap-4 text-left">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-colors ${attendanceData[s.id] ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                {s.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className={`font-black tracking-tight ${attendanceData[s.id] ? 'text-slate-800' : 'text-slate-400'}`}>{s.name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.schoolName}</p>
                            </div>
                        </div>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${attendanceData[s.id] ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}>
                            {attendanceData[s.id] ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </div>
                    </button>
                ))}
            </div>
        </div>

        <div className="p-8 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Present Count</p>
                    <p className="text-2xl font-black text-emerald-400 leading-none">{Object.values(attendanceData).filter(v => v).length}</p>
                </div>
                <div className="h-8 w-px bg-slate-800"></div>
                <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Absenteeism</p>
                    <p className="text-2xl font-black text-rose-400 leading-none">{Object.values(attendanceData).filter(v => !v).length}</p>
                </div>
            </div>

            <button 
                onClick={handleSubmit}
                disabled={submitting || students.length === 0}
                className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-900/50 disabled:opacity-30 disabled:cursor-not-allowed group"
            >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                        <CheckCircle2 className="w-4 h-4 group-hover:scale-125 transition-transform" />
                        Authorize & Sync Register
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
}

export default function MarkAttendancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
    </div>}>
      <MarkAttendanceContent />
    </Suspense>
  );
}
