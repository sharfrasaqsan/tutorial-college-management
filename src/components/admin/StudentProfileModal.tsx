"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Student, Payment, Class } from "@/types/models";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { 
  User, 
  Phone, 
  School, 
  MapPin, 
  Calendar, 
  BookOpen, 
  CreditCard, 
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck
} from "lucide-react";

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
}

export default function StudentProfileModal({ isOpen, onClose, studentId }: StudentProfileModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'payments' | 'activity'>('overview');

  useEffect(() => {
    async function loadStudentData() {
      if (!isOpen || !studentId) return;
      
      setLoading(true);
      try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (studentDoc.exists()) {
          const sData = { id: studentDoc.id, ...studentDoc.data() } as Student;
          setStudent(sData);

          // Parallel load related data
          const [paymentSnap, classSnap] = await Promise.all([
            getDocs(query(
              collection(db, "payments"), 
              where("studentId", "==", studentId),
              orderBy("createdAt", "desc"),
              limit(5)
            )),
            sData.enrolledClasses && sData.enrolledClasses.length > 0
              ? getDocs(query(collection(db, "classes"), where("__name__", "in", sData.enrolledClasses)))
              : Promise.resolve({ docs: [] })
          ]);

          setPayments(paymentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
          setClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
        }
      } catch (error) {
        console.error("Error loading student profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStudentData();
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={loading ? "Loading Profile..." : `${student?.name}'s Profile`}>
      <div className="space-y-6">
        {loading ? (
          <div className="space-y-6">
            <div className="flex items-center gap-6 p-2">
              <Skeleton variant="circle" width="80px" height="80px" />
              <div className="space-y-3 flex-1">
                <Skeleton variant="text" width="200px" height="24px" />
                <Skeleton variant="text" width="150px" height="16px" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton variant="rect" width="100%" height="100px" className="rounded-2xl" />
              <Skeleton variant="rect" width="100%" height="100px" className="rounded-2xl" />
            </div>
          </div>
        ) : student ? (
          <div className="space-y-6 overflow-hidden">
            {/* Header / Identity */}
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-black border-4 border-white shadow-xl shadow-primary/10">
                {student.name.charAt(0)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{student.name}</h2>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${student.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {student.status}
                    </span>
                </div>
                <p className="text-slate-500 font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    Student ID: <span className="font-bold text-slate-700">{student.studentId || "N/A"}</span>
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                        <Phone className="w-3 h-3" /> {student.phone || student.parentPhone}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                        <School className="w-3 h-3" /> {student.schoolName}
                    </div>
                </div>
              </div>
              <button 
                onClick={() => {
                   onClose();
                   router.push(`/admin/students/${student.id}`);
                }}
                className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-primary transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                Full Detail <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Navigation Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              {(['overview', 'sessions', 'payments', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-5 border border-slate-100 rounded-3xl space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <User className="w-3.5 h-3.5" /> Parent Information
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Primary Guardian</p>
                        <p className="text-sm font-bold text-slate-700">{student.parentName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Contact Number</p>
                        <p className="text-sm font-bold text-slate-700">{student.parentPhone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border border-slate-100 rounded-3xl space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" /> Location Details
                    </h4>
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Mailing Address</p>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{student.address}</p>
                    </div>
                  </div>

                  <div className="col-span-full p-5 bg-indigo-50/50 border border-indigo-100 rounded-3xl space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                      <History className="w-3.5 h-3.5" /> Enrollment Summary
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Grade</p>
                            <p className="text-base font-black text-indigo-600">{student.grade || 'N/A'}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Classes</p>
                            <p className="text-base font-black text-indigo-600">{student.enrolledClasses?.length || 0}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Since</p>
                            <p className="text-base font-black text-indigo-600">
                                {student.createdAt ? new Date(student.createdAt.seconds * 1000).getFullYear() : '2024'}
                            </p>
                        </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sessions' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {classes.length > 0 ? classes.map(cls => (
                        <div key={cls.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h5 className="font-bold text-slate-800 text-sm">{cls.name}</h5>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cls.subject} • {cls.teacherName}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Status</p>
                                <p className="text-xs font-bold text-emerald-600">Active Enrollment</p>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No Active Classes</p>
                        </div>
                    )}
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {payments.length > 0 ? payments.map(pay => (
                        <div key={pay.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:shadow-sm transition-all shadow-indigo-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-emerald-500">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <div>
                                    <h5 className="font-bold text-slate-800 text-sm">LKR {pay.amount.toLocaleString()}</h5>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{pay.month} • {pay.method}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">PAID</span>
                            </div>
                        </div>
                    )) : (
                        <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <CreditCard className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">No Invoice History</p>
                        </div>
                    )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-100">
                        <div className="relative">
                            <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-4 border-white shadow-sm shadow-emerald-200"></div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">Profile Initialized</p>
                                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" /> Registration completed securely by Administration.
                                </p>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-blue-500 border-4 border-white shadow-sm shadow-blue-200"></div>
                            <div>
                                <p className="text-xs font-bold text-slate-800">Class Allocation</p>
                                <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3 h-3" /> System automatically distributed seat allocation for {student.grade || 'requested'} level.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-red-100">
              <XCircle className="w-12 h-12 text-red-100 mx-auto mb-4" />
              <p className="text-red-500 font-bold uppercase tracking-widest text-sm underline-offset-4 decoration-2">Critical: Record Corrupted or Deleted</p>
              <p className="text-slate-400 text-xs mt-2 max-w-[200px] mx-auto font-medium">The requested student unique identifier does not map to any active record in the secure registry.</p>
          </div>
        )}

        <div className="pt-2">
            <button 
                onClick={onClose}
                className="w-full py-4 text-sm font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-3xl transition-all border border-slate-100"
            >
                Dismiss Profile View
            </button>
        </div>
      </div>
    </Modal>
  );
}
