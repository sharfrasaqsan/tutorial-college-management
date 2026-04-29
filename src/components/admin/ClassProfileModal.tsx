"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit, updateDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { 
  X, Mail, Phone, MapPin, BookOpen, Clock, Calendar, Activity,
  ArrowUpRight, Loader2, Users, GraduationCap, CreditCard, Layers, History, Hash, Edit,
  ChevronDown, ChevronRight, CheckCircle2 as CheckIcon, RefreshCcw
} from "lucide-react";
import { Class, Teacher, Student, Subject, Grade } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import { formatTime } from "@/lib/formatters";
import StudentProfileModal from "@/components/admin/StudentProfileModal";
import ClassModal from "@/components/admin/ClassModal";

interface ClassProfileModalProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
  isTeacherView?: boolean;
}

export default function ClassProfileModal({ classId, isOpen, onClose, isTeacherView }: ClassProfileModalProps) {
  const [classData, setClassData] = useState<Class | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'students' | 'schedule' | 'financials'>('overview');
  const [sessions, setSessions] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Student Profile View State
  const [isStudentViewOpen, setIsStudentViewOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set(['pending']));

  const groupedSessions = useMemo(() => {
    if (!sessions.length) return [];
    
    // Group 1: Sessions already processed (have a salaryId)
    // Group 2: Sessions not yet processed (no salaryId)
    
    const groups: Record<string, any[]> = {};
    const pendingSessions: any[] = [];
    
    sessions.forEach(s => {
        if (s.salaryId) {
            if (!groups[s.salaryId]) groups[s.salaryId] = [];
            groups[s.salaryId].push(s);
        } else {
            pendingSessions.push(s);
        }
    });

    const cycles: any[] = [];

    // Map salaries to their sessions
    salaries.forEach(sal => {
        const cycleSessions = groups[sal.id] || [];
        if (cycleSessions.length > 0) {
            // Sort sessions within cycle by date (oldest first for start/end)
            cycleSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            cycles.push({
                id: sal.id,
                number: sal.cycleNumber || 'Audit',
                sessions: [...cycleSessions].reverse(),
                startDate: cycleSessions[0].date,
                endDate: cycleSessions[cycleSessions.length - 1].date,
                isSettled: sal.status === 'paid',
                isFull: true,
                totalStudents: cycleSessions.reduce((acc, curr) => acc + (curr.studentCount || 0), 0) / cycleSessions.length
            });
        }
    });

    // Handle Pending Sessions (Current Accruing Cycle)
    if (pendingSessions.length > 0) {
        pendingSessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const lastCycleNumber = salaries.length > 0 ? Math.max(...salaries.map(s => s.cycleNumber || 0)) : 0;
        
        cycles.push({
            id: 'pending',
            number: lastCycleNumber + 1,
            sessions: [...pendingSessions].reverse(),
            startDate: pendingSessions[0].date,
            endDate: pendingSessions[pendingSessions.length - 1].date,
            isSettled: false,
            isFull: pendingSessions.length >= (classData?.sessionsPerCycle || 8),
            totalStudents: pendingSessions.reduce((acc, curr) => acc + (curr.studentCount || 0), 0) / pendingSessions.length
        });
    }

    // Return descending by cycle number
    return cycles.sort((a, b) => {
        if (typeof a.number === 'number' && typeof b.number === 'number') return b.number - a.number;
        return 0;
    });
  }, [sessions, salaries, classData?.sessionsPerCycle]);

  const toggleCycle = (id: string) => {
    const next = new Set(expandedCycles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCycles(next);
  };

  const cleanName = useCallback((name: string) => {
    if (!isTeacherView || !name) return name || "Unnamed Class";
    return name.replace(/\s*\([^)]*\)$/, "").trim();
  }, [isTeacherView]);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      // 1. Fetch Class Info
      const classDoc = await getDoc(doc(db, "classes", classId));
      if (!classDoc.exists()) {
        setLoading(false);
        return;
      }
      const cData = { id: classDoc.id, ...classDoc.data() } as Class;
      setClassData(cData);

      // 2. Fetch Teacher Info
      if (cData.teacherId) {
        const tDoc = await getDoc(doc(db, "teachers", cData.teacherId));
        if (tDoc.exists()) {
          setTeacher({ id: tDoc.id, ...tDoc.data() } as Teacher);
        }
      }

      // 3. Fetch Enrolled Students
      const studentQuery = query(
        collection(db, "students"), 
        where("enrolledClasses", "array-contains", classId)
      );
      const studentSnap = await getDocs(studentQuery);
      setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));

    } catch (error) {
      console.error("Error loading class profile:", error);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const loadSessions = useCallback(async () => {
    if (!classId) return;
    setSessionsLoading(true);
    try {
      // 1. Fetch Salaries (to define cycles)
      const salQ = query(
        collection(db, "salaries"),
        where("classId", "==", classId),
        orderBy("createdAt", "asc")
      );
      const salSnap = await getDocs(salQ);
      const salDocs = salSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSalaries(salDocs);

      // 2. Fetch Sessions
      const q = query(
        collection(db, "session_completions"),
        where("classId", "==", classId),
        limit(200)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort locally
      docs.sort((a: any, b: any) => {
        const t1 = a.timestamp?.seconds || 0;
        const t2 = b.timestamp?.seconds || 0;
        return t2 - t1; // Descending
      });
      
      setSessions(docs);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setSessionsLoading(false);
    }
  }, [classId]);

  const handleStudentView = (id: string) => {
    setSelectedStudentId(id);
    setIsStudentViewOpen(true);
  };

  const handleSyncStats = async () => {
    if (!classId || !classData) return;
    setIsSyncing(true);
    const toastId = toast.loading("Auditing institutional ledger...");
    
    try {
      // 1. Fetch ALL sessions for this class to get true counts
      const q = query(collection(db, "session_completions"), where("classId", "==", classId));
      const snap = await getDocs(q);
      const allSessions = snap.docs.map(d => d.data());
      
      const actualTotal = allSessions.length;
      const actualPending = allSessions.filter(s => !s.isPaid).length;
      
      // 2. Fetch Salaries for true cycle count
      const salQ = query(collection(db, "salaries"), where("classId", "==", classId));
      const salSnap = await getDocs(salQ);
      const actualCycles = salSnap.docs.length;
      
      // 3. Update the Class document
      await updateDoc(doc(db, "classes", classId), {
        completedSessions: actualTotal,
        sessionsSinceLastPayment: actualPending,
        completedCycles: actualCycles,
        updatedAt: serverTimestamp()
      });
      
      // 4. Refresh local state
      setClassData(prev => prev ? { 
        ...prev, 
        completedSessions: actualTotal, 
        sessionsSinceLastPayment: actualPending,
        completedCycles: actualCycles 
      } : null);
      
      await loadSessions();
      
      toast.success("Academic integrity restored!", { id: toastId });
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to synchronize stats.", { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFinishSyllabus = async () => {
    // Feature disabled: will implement later
    toast.error("This feature is currently being optimized for the next academic release.");
  };

  useEffect(() => {
    if (isOpen && classId) {
      setActiveTab('overview');
      loadData();
      loadSessions();
    }
  }, [isOpen, classId, loadData, loadSessions]);

  if (!isOpen) return null;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* Header - High Fidelity Terminal Style */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <BookOpen className="w-7 h-7" />}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {loading ? <Skeleton variant="text" width="180px" height="24px" /> : cleanName(classData?.name || "")}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" /> {loading ? "..." : classData?.subject}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${classData?.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {loading ? "..." : classData?.status}
                         </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={handleSyncStats}
                    disabled={isSyncing}
                    className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 transition-all border border-slate-100 hover:border-indigo-100 flex items-center justify-center disabled:opacity-50"
                    title="Synchronize Stats"
                >
                    <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                </button>
                {!isTeacherView && (
                    <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all shadow-sm active:scale-95"
                    >
                        <Edit className="w-3.5 h-3.5" /> Edit Class
                    </button>
                )}
                <button 
                    onClick={onClose}
                    className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Professional Navigation Bar */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-hide">
            {(['overview', 'sessions', 'students', 'schedule', 'financials'] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize whitespace-nowrap ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab === 'overview' ? 'Overview' : tab === 'sessions' ? 'Completed Sessions' : tab === 'students' ? 'Students' : tab === 'schedule' ? 'Schedule' : 'Insights'}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                    )}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                    </div>
                </div>
            ) : classData && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-10">
                            {/* KPI Board */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {[
                                    { label: 'Enrolled', value: `${students.length} Students`, icon: Users, color: 'bg-primary/5 text-primary border-primary/10' },
                                    { label: 'Grade', value: classData.grade, icon: GraduationCap, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                    { label: 'Monthly Fee', value: `LKR ${classData.monthlyFee?.toLocaleString()}`, icon: CreditCard, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                    { label: 'Completed Cycles', value: Math.floor((classData.completedSessions || 0) / (classData.sessionsPerCycle || 8)), icon: History, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                                    { label: 'Created', value: formatDate(classData.createdAt), icon: Calendar, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                ].map((stat, i) => (
                                    <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${stat.color}`}>
                                        <stat.icon className="w-4 h-4" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">{stat.label}</p>
                                            <p className="text-base font-bold tracking-tight">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Instructor Assignment</h4>
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400 shadow-sm">
                                                {teacher?.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">{teacher?.name || 'Unassigned'}</p>
                                                <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">Lead {classData.subject} Teacher</p>
                                                <div className="flex items-center gap-4 mt-3">
                                                   <div className="flex items-center gap-1.5">
                                                      <Mail className="w-3 h-3 text-slate-300" />
                                                      <span className="text-[11px] font-medium text-slate-500">{teacher?.email || 'No email'}</span>
                                                   </div>
                                                   <div className="flex items-center gap-1.5">
                                                      <Phone className="w-3 h-3 text-slate-300" />
                                                      <span className="text-[11px] font-medium text-slate-500">{teacher?.phone || 'No phone'}</span>
                                                   </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                   <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Operational Details</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Sessions Per Cycle</span>
                                                <span className="text-xs font-bold text-slate-800">{classData.sessionsPerCycle || 8} Sessions</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Current Cycle Progress</span>
                                                <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${Math.max(0, classData.sessionsSinceLastPayment || 0) >= (classData.sessionsPerCycle || 8) ? 'bg-primary text-white' : 'bg-primary/5 text-primary'}`}>
                                                    {Math.max(0, classData.sessionsSinceLastPayment || 0)} / {classData.sessionsPerCycle || 8} Logged
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Total Completed</span>
                                                <span className="text-xs font-bold text-slate-800">{classData.completedSessions || 0} Sessions</span>
                                            </div>
                                        </div>
                                   </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sessions' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Academic Cycles</h4>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{groupedSessions.length} Cycles Logged</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Settled</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                        <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">Accruing</span>
                                    </div>
                                </div>
                             </div>
                             
                             {sessionsLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <Skeleton key={i} variant="rect" width="100%" height="80px" className="rounded-2xl" />)}
                                </div>
                             ) : groupedSessions.length > 0 ? (
                                <div className="space-y-4">
                                    {groupedSessions.map((cycle) => (
                                        <div key={cycle.number} className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm transition-all hover:border-slate-200">
                                            {/* Cycle Header */}
                                            <button 
                                                onClick={() => toggleCycle(cycle.id)}
                                                className={`w-full px-6 py-4 flex items-center justify-between transition-colors ${expandedCycles.has(cycle.id) ? 'bg-slate-50/50' : 'bg-white'}`}
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center border ${cycle.isSettled ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                                        <span className="text-[8px] font-black uppercase leading-none mb-0.5">Cycle</span>
                                                        <span className="text-base font-black leading-none">{cycle.number}</span>
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-bold text-slate-800 tracking-tight">
                                                            {new Date(cycle.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                                            <span className="mx-2 text-slate-300">→</span>
                                                            {new Date(cycle.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{cycle.sessions.length} Sessions</span>
                                                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Avg. {Math.round(cycle.totalStudents)} Students</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {cycle.isSettled ? (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                                            <CheckIcon className="w-3 h-3" />
                                                            Fully Settled
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
                                                            <Clock className="w-3 h-3" />
                                                            {cycle.isFull ? 'Awaiting Payout' : 'In Progress'}
                                                        </div>
                                                    )}
                                                    {expandedCycles.has(cycle.number) ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                                                </div>
                                            </button>

                                            {/* Sessions List (Collapsible) */}
                                            {expandedCycles.has(cycle.id) && (
                                                <div className="border-t border-slate-100 bg-white p-2 divide-y divide-slate-50">
                                                    {cycle.sessions.map((session: any) => (
                                                        <div key={session.id} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded-lg group/item">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 group-hover/item:text-primary transition-colors">
                                                                    <Calendar className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-slate-700">
                                                                        {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{formatTime(session.startTime)}</span>
                                                                        <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{session.studentCount || 0} Present</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter ${session.isPaid ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' : 'bg-amber-50 text-amber-500 border border-amber-100'}`}>
                                                                {session.isPaid ? 'Settled' : 'Unpaid'}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-slate-200 mb-4 shadow-sm">
                                        <History className="w-8 h-8" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No sessions recorded yet</p>
                                </div>
                             )}
                        </div>
                    )}

                    {activeTab === 'students' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Enrolled Students</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{students.length} Students</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {students.length > 0 ? students.map((std) => (
                                    <div key={std.id} className="p-4 rounded-xl border border-slate-100 hover:border-primary/20 transition-all bg-white group flex items-center justify-between shadow-sm hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-sm font-bold group-hover:bg-primary group-hover:text-white transition-all">
                                                {std.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-sm">{std.name}</h5>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {std.studentId}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleStudentView(std.id)}
                                            className="p-2 rounded-lg hover:bg-slate-50 text-slate-300 hover:text-primary transition-colors"
                                        >
                                            <ArrowUpRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No students enrolled yet</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Session Schedule</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{(classData.schedules || []).length} Slots</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(classData.schedules || []).map((slot, idx) => (
                                    <div key={idx} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-base capitalize">{slot.dayOfWeek}</h5>
                                                <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] mb-1 leading-none">Hall / Room</p>
                                            <p className="text-sm font-black text-slate-600">{slot.room || 'TBD'}</p>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Revenue Insights</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-500">Est. Monthly Revenue</span>
                                            <span className="text-lg font-bold text-slate-800">LKR {(classData.monthlyFee * students.length).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-slate-500">Active Students</span>
                                            <span className="font-bold text-slate-800">{students.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-slate-500">Fee Per Student</span>
                                            <span className="font-bold text-slate-800">LKR {classData.monthlyFee?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-200/50">
                                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                                            <History className="w-4 h-4 text-amber-600 mt-0.5" />
                                            <p className="text-[10px] font-medium text-amber-700 leading-relaxed italic">Revenue shown is a gross estimate based on current enrollment and standard fee. Individual scholarship adjustments not factored here.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-center items-center text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                                        <History className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-slate-800">Operational Summary</h4>
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-2 justify-center">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Sessions:</span>
                                                <span className="text-sm font-bold text-slate-800">{classData.completedSessions || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-2 justify-center">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cycles:</span>
                                                <span className="text-sm font-bold text-slate-800">{Math.floor((classData.completedSessions || 0) / (classData.sessionsPerCycle || 8))}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Global Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-0.5 leading-none">Note: Details verified</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-8 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 hover:bg-white transition-all shadow-sm active:scale-95"
                >
                    Close
                </button>
            </div>
        </div>
      </div>

      <StudentProfileModal 
        isOpen={isStudentViewOpen}
        onClose={() => {
            setIsStudentViewOpen(false);
            setSelectedStudentId(null);
        }}
        studentId={selectedStudentId || ""}
      />

      <ClassModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
            loadData();
            setIsEditModalOpen(false);
        }}
        initialData={classData}
      />
    </div>
  );
}
