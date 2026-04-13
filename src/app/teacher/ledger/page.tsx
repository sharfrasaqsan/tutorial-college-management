"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs, getDoc, doc, deleteDoc, updateDoc, increment, writeBatch, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CheckCircle2, 
  Clock, 
  History, 
  Calendar,
  Layers,
  Banknote,
  Navigation,
  BookOpen
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Class, Salary, Teacher } from "@/types/models";
import { formatTime, formatMonthYear, formatDate } from "@/lib/formatters";

interface SessionCompletion {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  date: string;
  dayOfWeek: string;
  timestamp: any;
  startTime: string;
  endTime?: string;
  room: string;
  subject: string;
  grade?: string;
  isPaid?: boolean;
}

export default function SessionHistoryPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<Salary | null>(null);
  const [cycleSessions, setCycleSessions] = useState<SessionCompletion[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // 1. Initial Load: Fetch Teacher's Classes & Profie
  useEffect(() => {
    async function loadData() {
      if (!user?.uid) return;
      try {
        const [classesSnap, teacherSnap] = await Promise.all([
          getDocs(query(collection(db, "classes"), where("teacherId", "==", user.uid))),
          getDoc(doc(db, "teachers", user.uid))
        ]);

        const fetchedClasses = classesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Class));
        setClasses(fetchedClasses);
        if (teacherSnap.exists()) setTeacherData(teacherSnap.data() as Teacher);
        
        if (fetchedClasses.length > 0) {
          setActiveTab(fetchedClasses[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // 2. Fetch Salaries for Active Class & Year
  useEffect(() => {
    if (!user?.uid || !activeTab) return;

    async function fetchSalaries() {
      const yearStart = `${selectedYear}-01`;
      const yearEnd = `${selectedYear}-12`;
      
      const q = query(
        collection(db, "salaries"),
        where("teacherId", "==", user!.uid),
        where("classId", "==", activeTab),
        where("month", ">=", yearStart),
        where("month", "<=", yearEnd),
        orderBy("month", "desc")
      );
      try {
        const snap = await getDocs(q);
        setSalaries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Salary)));
      } catch (err) {
        console.error("Failed to load cycles", err);
      }
    }
    fetchSalaries();
  }, [user, activeTab, selectedYear]);

  // 3. Open Modal and Fetch Sessions for Cycle
  const openCycleModal = async (salary: Salary) => {
    setSelectedSalary(salary);
    setIsModalOpen(true);
    setSessionsLoading(true);
    try {
        // REMOVED orderBy to avoid composite index requirements
        const q = query(
            collection(db, "session_completions"),
            where("salaryId", "==", salary.id)
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionCompletion));
        
        // Sort locally by timestamp
        docs.sort((a, b) => {
            const t1 = a.timestamp?.seconds || 0;
            const t2 = b.timestamp?.seconds || 0;
            return t1 - t2;
        });
        
        setCycleSessions(docs);
    } catch (err) {
        console.error("Failed to load sessions", err);
    } finally {
        setSessionsLoading(false);
    }
  };

  const currentClass = classes.find(c => c.id === activeTab);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      
      {/* 🏛️ Page Header - Dashboard Style Parity */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Class History
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider leading-none">
            Your previous classes and payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Class Selection Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm min-w-[200px]">
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Class</span>
            </div>
            <select
                value={activeTab || ""}
                onChange={(e) => setActiveTab(e.target.value)}
                className="bg-transparent flex-1 px-4 py-1.5 text-sm font-black text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors uppercase tracking-tight"
            >
                {[...classes]
                  .sort((a, b) => (a.grade || "").localeCompare(b.grade || "", undefined, { numeric: true }))
                  .map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
            </select>
          </div>

          {/* Year Selector Dropdown - Styled as Action */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100">
                <Calendar className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Year</span>
            </div>
            <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent px-4 py-1.5 text-sm font-black text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors"
            >
                {Array.from(new Set([
                    new Date().getFullYear().toString(),
                    ...salaries.map(s => s.month.split('-')[0])
                ])).sort((a, b) => b.localeCompare(a)).map(y => (
                    <option key={y} value={y.toString()}>{y} Academic Year</option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cycles Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map(j => <Skeleton key={j} width="100%" height="220px" className="rounded-3xl" />)}
        </div>
      ) : activeTab && currentClass ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {salaries.length > 0 ? salaries.map(salary => (
                <div key={salary.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 group overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${salary.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} transition-colors`}>
                                <Banknote className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">{formatMonthYear(salary.month)}</p>
                                <p className="text-sm font-black text-slate-800">Payment {salary.id.slice(-4).toUpperCase()}</p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border ${salary.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                            {salary.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                    </div>
                    <div className="p-6 flex-1 bg-white">
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Classes Done</p>
                                <p className="text-xl font-black text-slate-800">{salary.sessionsConducted} <span className="text-xs text-slate-400 font-bold">/ {salary.sessionsPerCycle}</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Amount</p>
                                <p className="text-xl font-black text-indigo-600">LKR {salary.netAmount?.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                            <Calendar className="w-3.5 h-3.5" /> Logged on {formatDate(salary.createdAt)}
                        </div>
                    </div>
                    <div className="p-2 bg-slate-50/50 border-t border-slate-50">
                        <button 
                            onClick={() => openCycleModal(salary)}
                            className="w-full py-3 bg-white text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 border border-slate-200 group-hover:border-indigo-600"
                        >
                            View Classes <Navigation className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            )) : (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-white rounded-[3rem] border border-slate-100 outline outline-1 outline-slate-50">
                    <Layers className="w-16 h-16 text-slate-100 mb-4" />
                    <h4 className="text-lg font-black text-slate-800">No classes yet</h4>
                    <p className="text-sm text-slate-400 max-w-sm mt-2">You haven't reached 8 classes for this payment yet. Keep teaching!</p>
                </div>
            )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] text-center px-10 bg-white rounded-[3rem] border border-slate-100 outline outline-1 outline-slate-50">
            <BookOpen className="w-20 h-20 text-slate-100 mb-6" />
            <h4 className="text-xl font-black text-slate-700 mb-2 italic">Select a Class</h4>
            <p className="text-sm text-slate-400 max-w-xs font-medium">Pick a class from the list above to see your previous classes and payments.</p>
        </div>
      )}

      {/* Cycle Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Detailed Breakdown`}>
        {selectedSalary && (
            <div className="space-y-6">
                <div className="flex items-center justify-between p-5 bg-indigo-50 border border-indigo-100 rounded-3xl">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">{selectedSalary.className}</p>
                        <p className="text-2xl font-black text-indigo-900">{formatMonthYear(selectedSalary.month)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 mb-1">Status</p>
                        <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border bg-white ${selectedSalary.status === 'paid' ? 'text-emerald-600 border-emerald-200' : 'text-amber-600 border-amber-200'} shadow-sm`}>
                            {selectedSalary.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Recorded Classes ({cycleSessions.length}/{selectedSalary.sessionsPerCycle})
                    </h4>
                    
                    {sessionsLoading ? (
                        <div className="space-y-2">
                            {[1,2,3,4].map(k => <Skeleton key={k} height="60px" width="100%" className="rounded-2xl" />)}
                        </div>
                    ) : (
                        <div className="border border-slate-100 rounded-[2rem] overflow-hidden bg-white">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                                        <th className="px-6 py-4">#</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Time</th>
                                        <th className="px-6 py-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {cycleSessions.map((session, index) => (
                                        <tr key={session.id} className="hover:bg-slate-50/30 transition-colors group/row">
                                            <td className="px-6 py-4">
                                                <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all">
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs font-black text-slate-800 tracking-tight">{session.date}</p>
                                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mt-0.5">{session.dayOfWeek}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                                                        <Clock className="w-3 h-3 text-indigo-400" />
                                                        <span className="text-[10px] font-black text-slate-600 tabular-nums">
                                                            {formatTime(session.startTime)} - {session.endTime ? formatTime(session.endTime) : '--:--'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {session.timestamp && (
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1.5 ml-1">
                                                        Logged {new Date(session.timestamp.seconds * 1000 + session.timestamp.nanoseconds / 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                                                    <CheckCircle2 className="w-3 h-3" /> Recorded
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {cycleSessions.length === 0 && !sessionsLoading && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs italic font-bold">
                                                No specific session logs found for this cycle.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
}
