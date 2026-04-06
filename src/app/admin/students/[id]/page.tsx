"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Student, Payment, Class, AttendanceRecord } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  School, 
  Calendar, 
  CreditCard, 
  ClipboardCheck, 
  Settings,
  ShieldCheck,
  TrendingUp,
  BookOpen,
  History,
  FileText
} from "lucide-react";
import Link from "next/link";

export default function StudentDetailPage() {
  const { id: paramId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    async function fetchFullDetails() {
      if (!paramId) return;
      try {
        const studentSnap = await getDoc(doc(db, "students", paramId as string));
        if (studentSnap.exists()) {
          const sData = { id: studentSnap.id, ...studentSnap.data() } as Student;
          setStudent(sData);

          // Fetch deep related data
          const [paySnap, classSnap, attendSnap] = await Promise.all([
            getDocs(query(collection(db, "payments"), where("studentId", "==", paramId), orderBy("createdAt", "desc"))),
            sData.enrolledClasses?.length 
              ? getDocs(query(collection(db, "classes"), where("__name__", "in", sData.enrolledClasses)))
              : Promise.resolve({ docs: [] }),
            getDocs(query(collection(db, "attendance"), where("studentId", "==", paramId), orderBy("date", "desc"), limit(10)))
          ]);

          setPayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
          setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
          setAttendance(attendSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
        }
      } catch (err) {
        console.error("Deep fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchFullDetails();
  }, [paramId]);

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <Skeleton variant="rect" width="120px" height="40px" className="rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-3xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton variant="rect" width="100%" height="400px" className="rounded-3xl" />
            <Skeleton variant="rect" width="100%" height="400px" className="rounded-3xl" />
            <Skeleton variant="rect" width="100%" height="400px" className="rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!student) return <div>Record Not Found</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Students
        </button>
        <div className="flex gap-3">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Export Dossier
            </button>
            <button className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                <Settings className="w-4 h-4" /> Manage Profile
            </button>
        </div>
      </div>

      {/* Main Profile Identity Card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden relative">
        <div className="h-32 bg-indigo-900 w-full relative overflow-hidden">
            {/* Abstract design */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
        </div>
        <div className="px-8 pb-8 -mt-16 flex flex-col md:flex-row gap-8 items-end relative z-10">
            <div className="w-32 h-32 rounded-full border-8 border-white bg-indigo-50 flex items-center justify-center text-indigo-600 text-5xl font-black shadow-2xl shadow-indigo-100">
                {student.name.charAt(0)}
            </div>
            <div className="flex-1 pb-4">
                <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">{student.name}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> {student.studentId}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-400">
                        <Calendar className="w-4 h-4 text-indigo-500" /> Joined {student.createdAt ? new Date(student.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {student.status}
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pb-4 w-full md:w-auto">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Classes</p>
                    <p className="text-2xl font-black text-indigo-600">{student.enrolledClasses?.length || 0}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Attendance rate</p>
                    <p className="text-2xl font-black text-emerald-600">92%</p>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Personal Archive */}
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-600" /> Identity Dossier
                </h3>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                            <Phone className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Primary Contact</p>
                            <p className="text-sm font-bold text-slate-700">{student.phone}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Parent/Guardian</p>
                            <p className="text-sm font-bold text-slate-700">{student.parentName} ({student.parentPhone})</p>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Resident Address</p>
                            <p className="text-sm font-bold text-slate-700 leading-relaxed">{student.address}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                            <School className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Academic School</p>
                            <p className="text-sm font-bold text-slate-700">{student.schoolName}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-indigo-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
                <div className="relative z-10">
                    <TrendingUp className="w-10 h-10 text-yellow-400 mb-4" />
                    <h4 className="text-xl font-black mb-2">Student Progression</h4>
                    <p className="text-indigo-200 text-xs mb-8 font-medium">Currently outperforming 85% of batch classmates in {student.grade} level curriculum metrics.</p>
                    <div className="h-2 w-full bg-indigo-700/50 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 w-[85%] shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
                    </div>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-indigo-300">Curricular Benchmark: 85.0/100</p>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-400/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            </div>
        </div>

        {/* Center Column: Academic Sessions */}
        <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-600" /> Academic Portfolio
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{classes.length} Enrolled Courses</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {classes.length > 0 ? classes.map(cls => (
                        <div key={cls.id} className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all group flex flex-col h-full">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform mb-4">
                                <BookOpen className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-black text-slate-800 mb-1">{cls.name}</h4>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{cls.subject} • {cls.teacherName}</p>
                            <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Schedule</p>
                                    <p className="text-xs font-bold text-slate-700">Tue, 4:00 PM</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Room</p>
                                    <p className="text-xs font-bold text-indigo-600">AFL-002</p>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-center opacity-50">
                            <BookOpen className="w-12 h-12 mb-4" />
                            <p className="font-bold uppercase tracking-widest text-sm">No recorded allocations</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                        <CreditCard className="w-5 h-5 text-emerald-500" /> Financial Ledger
                    </h3>
                    <div className="space-y-4">
                        {payments.length > 0 ? payments.slice(0, 4).map(pay => (
                            <div key={pay.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <p className="text-sm font-black text-slate-800">LKR {pay.amount.toLocaleString()}</p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{pay.month} Session</p>
                                </div>
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest">Captured</span>
                            </div>
                        )) : (
                            <p className="text-center py-8 text-slate-400 font-bold uppercase text-[10px] tracking-widest">No transaction history</p>
                        )}
                    </div>
                    <button className="w-full mt-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-colors border-t border-slate-50">Comprehensive Ledger Download</button>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">
                        <ClipboardCheck className="w-5 h-5 text-indigo-600" /> Attendance logs
                    </h3>
                    <div className="space-y-6 flex-1">
                        <div className="relative pl-4 space-y-6 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="relative">
                                    <div className="absolute -left-[1.35rem] top-1.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></div>
                                    <p className="text-xs font-bold text-slate-800">Advanced Mathematics - Session #{i}</p>
                                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                                        March {(10+i).toString()}, 2024 • Early Access
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className="w-full mt-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-primary transition-colors border-t border-slate-50">View Analytics Dashboard</button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

// Removed local limit placeholder function.
