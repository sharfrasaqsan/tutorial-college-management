"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, deleteDoc, doc, updateDoc, increment, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CheckCircle2, 
  Clock, 
  X, 
  History, 
  Search,
  BookOpen
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Class } from "@/types/models";

interface SessionCompletion {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  date: string;
  dayOfWeek: string;
  timestamp: Timestamp;
  startTime: string;
  room: string;
  subject: string;
  grade: string;
  studentCount?: number;
}

export default function SessionHistoryPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Initial Load: Fetch Teacher's Classes
  useEffect(() => {
    async function loadClasses() {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, "classes"), where("teacherId", "==", user.uid));
        const snap = await getDocs(q);
        const fetchedClasses = snap.docs.map(d => ({ ...d.data(), id: d.id } as Class));
        setClasses(fetchedClasses);
        if (fetchedClasses.length > 0) {
          setActiveTab(fetchedClasses[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, [user]);

  // 2. Tab Listener: Fetch Completions for Active Class
  useEffect(() => {
    if (!user?.uid || !activeTab) return;

    setCompletionsLoading(true);
    const completionsRef = collection(db, "session_completions");
    const q = query(
        completionsRef, 
        where("teacherId", "==", user.uid),
        where("classId", "==", activeTab),
        orderBy("timestamp", "desc"),
        limit(100)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
        const logs = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SessionCompletion));
        setCompletions(logs);
        setCompletionsLoading(false);
    }, () => {
        setCompletionsLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  const deleteSession = async (session: SessionCompletion) => {
    const confirmed = window.confirm(`Are you sure you want to mark this session from ${session.date} as incomplete?`);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "session_completions", session.id));
        await updateDoc(doc(db, "classes", session.classId), {
            completedSessions: increment(-1)
        });
        toast.success("Log entry reverted successfully.");
    } catch {
        toast.error("Correction failed. Check permissions.");
    }
  };

  const filteredCompletions = completions.filter(c => 
    (c.date.includes(searchTerm) || c.dayOfWeek.toLowerCase().includes(searchTerm.toLowerCase())) &&
    c.classId === activeTab
  );

  const currentClass = classes.find(c => c.id === activeTab);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                <div className="bg-indigo-600 p-2 rounded-2xl shadow-lg shadow-indigo-100">
                    <History className="w-6 h-6 text-white" />
                </div>
                Session Ledger
            </h2>
            <p className="text-slate-500 font-medium text-sm">Review your finalized academic footprint per classification.</p>
        </div>
        
        <div className="relative w-full lg:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Ledger (YYYY-MM-DD)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-[1.25rem] text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all font-medium shadow-sm"
            />
        </div>
      </div>

      {/* Class Tabs - Unified UI with Student List */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide no-scrollbar">
          {loading ? (
            [1, 2, 3].map(i => <Skeleton key={i} width="140px" height="42px" className="rounded-xl flex-shrink-0" />)
          ) : classes.length > 0 ? classes.map((cls) => (
            <button
                key={cls.id}
                onClick={() => setActiveTab(cls.id)}
                className={`flex-shrink-0 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeTab === cls.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-100' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
                {cls.grade} - {cls.name}
            </button>
          )) : (
            <p className="text-xs text-slate-400 italic">No classes found.</p>
          )}
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden outline outline-1 outline-slate-50 min-h-[500px]">
          {loading || completionsLoading ? (
               <div className="space-y-4 p-8">
                 {[1, 2, 3, 4, 5].map(j => <Skeleton key={j} width="100%" height="70px" className="rounded-2xl" />)}
               </div>
          ) : activeTab && currentClass ? (
            <div className="overflow-x-auto animate-in fade-in zoom-in-95 duration-500">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-50">
                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Date Log</th>
                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Schedule Time</th>
                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Completion Marked Time</th>
                            <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredCompletions.length > 0 ? filteredCompletions.map((log) => (
                            <tr key={log.id} className="hover:bg-indigo-50/10 transition-colors group">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600 font-black group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                            <span className="text-[9px] leading-none uppercase">{format(new Date(log.date), "MMM")}</span>
                                            <span className="text-lg leading-none">{format(new Date(log.date), "dd")}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 tracking-tight capitalize">{log.dayOfWeek}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{log.date}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-indigo-500" />
                                        <span className="text-sm font-black text-slate-700">{log.startTime}</span>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-sm font-black text-slate-700">
                                            {log.timestamp ? format(log.timestamp.toDate(), "hh:mm a") : "--:--"}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right flex items-center justify-end gap-3">
                                    <button 
                                        onClick={() => deleteSession(log)}
                                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 group/btn"
                                        title="Revert Completion"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
                                        <CheckCircle2 size={12} /> Logged
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-8 py-32 text-center">
                                    <History className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                                    <h4 className="text-lg font-black text-slate-400 italic">No entry logs for this class.</h4>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mt-2">Class Identity: {currentClass.name}</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-center px-10">
                <BookOpen className="w-20 h-20 text-slate-100 mb-6" />
                <h4 className="text-xl font-black text-slate-700 mb-2 italic">Registry Standby</h4>
                <p className="text-sm text-slate-400 max-w-xs font-medium">Select a class classification from the tabs above to inspect the session verification ledger.</p>
            </div>
          )}
      </div>
    </div>
  );
}
