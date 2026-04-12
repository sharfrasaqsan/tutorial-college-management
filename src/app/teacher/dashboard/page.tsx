"use client";

import { useAuth } from "@/context/AuthContext";
import { 
  Users, 
  Layers, 
  Calendar, 
  CheckCircle2,
  Wallet,
  Activity,
  CheckCircle,
  GraduationCap,
  MapPin,
  RotateCcw,
  Clock,
  Lock
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useState, useEffect, useMemo } from "react";
import { 
  collection,
  query,
  where,
  orderBy,
  limit,
  doc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc, 
  onSnapshot, 
  getDoc,
  Timestamp,
  getDocs,
  writeBatch,
  deleteField
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Teacher, Salary } from "@/types/models";
import { format } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";
import { processTeacherPayroll } from "@/lib/payroll";

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
  isPaid?:boolean;
}

interface ExtraSession {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  grade: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
}

interface TodayClass extends Partial<Class> {
  id: string;
  name: string;
  grade: string;
  subject: string;
  currentSlot: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string;
  };
  isCompleted: boolean;
  isPaid?: boolean;
  isExtra?: boolean;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [todayCompletions, setTodayCompletions] = useState<SessionCompletion[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<SessionCompletion[]>([]);
  const [latestSalary, setLatestSalary] = useState<Salary | null>(null);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [extraSessionsToday, setExtraSessionsToday] = useState<ExtraSession[]>([]);
  const [salariesCount, setSalariesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const tRef = doc(db, "teachers", user.uid);
    const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid));
    
    // FIX: Query today's completions specifically (not a global limit)
    const qTodayComp = query(
        collection(db, "session_completions"), 
        where("teacherId", "==", user.uid),
        where("date", "==", todayStr)
    );

    // Separate query for recent activity feed
    const qRecentComp = query(
        collection(db, "session_completions"), 
        where("teacherId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(10)
    );

    const salaryRef = collection(db, "salaries");
    const salaryQuery = query(salaryRef, where("teacherId", "==", user.uid), orderBy("createdAt", "desc"), limit(1));

    const unsubscribeTeacher = onSnapshot(tRef, (snap) => {
      if (snap.exists()) setTeacherData({ id: snap.id, ...snap.data() } as Teacher);
    });

    const unsubscribeClasses = onSnapshot(qClasses, (snap) => {
        const classesList = snap.docs.map(d => ({ ...d.data(), id: d.id } as Class));
        setAllClasses(classesList);
        setLoading(false);
    });

    const unsubscribeTodayComp = onSnapshot(qTodayComp, (snap) => {
        setTodayCompletions(snap.docs.map(d => ({ ...d.data(), id: d.id } as SessionCompletion)));
    });

    const unsubscribeRecentComp = onSnapshot(qRecentComp, (snap) => {
        setRecentCompletions(snap.docs.map(d => ({ ...d.data(), id: d.id } as SessionCompletion)));
    });

    const unsubscribeSalary = onSnapshot(salaryQuery, (snap) => {
        if (!snap.empty) setLatestSalary({ id: snap.docs[0].id, ...snap.docs[0].data() } as Salary);
    });

    const currentYear = new Date().getFullYear().toString();
    const yearlySalariesQuery = query(
        salaryRef, 
        where("teacherId", "==", user.uid), 
        where("month", ">=", `${currentYear}-01`),
        where("month", "<=", `${currentYear}-12`)
    );
    const unsubscribeYearlySalaries = onSnapshot(yearlySalariesQuery, (snap) => {
        setSalariesCount(snap.size);
    });

    const qExtrasToday = query(
        collection(db, "extra_sessions"),
        where("teacherId", "==", user.uid),
        where("date", "==", todayStr)
    );
    const unsubscribeExtrasToday = onSnapshot(qExtrasToday, (snap) => {
        setExtraSessionsToday(snap.docs.map(d => ({ ...d.data(), id: d.id } as ExtraSession)));
    });

    return () => {
        unsubscribeTeacher();
        unsubscribeClasses();
        unsubscribeTodayComp();
        unsubscribeRecentComp();
        unsubscribeSalary();
        unsubscribeYearlySalaries();
        unsubscribeExtrasToday();
    };
  }, [user]);

  // Derived state for Today's specific sessions — uses today-specific completions
  const todayClasses = useMemo(() => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const currentDay = format(currentTime, "EEEE").toLowerCase();
    
    // Regular sessions for today
    const regularToday = allClasses.flatMap(cls => {
      const slots = (cls.schedules || []).filter(s => s.dayOfWeek.toLowerCase() === currentDay);
      return slots.map(slot => {
        const startTimeSafe = slot.startTime.replace(/:/g, '-');
        const completionId = `${cls.id}_${todayStr}_${startTimeSafe}`;
        const completion = todayCompletions.find(c => c.id === completionId);
        
        return {
          ...cls,
          currentSlot: slot,
          isCompleted: !!completion,
          isPaid: !!completion?.isPaid,
          isExtra: false
        } as TodayClass;
      });
    });

    // Extra sessions for today
    const extrasToday = extraSessionsToday.map(extra => {
      const startTimeSafe = extra.startTime.replace(/:/g, '-');
      const completionId = `${extra.classId}_${todayStr}_${startTimeSafe}`;
      const completion = todayCompletions.find(c => c.id === completionId);

      return {
        id: extra.classId,
        name: extra.className,
        grade: extra.grade,
        subject: extra.subject,
        currentSlot: {
            dayOfWeek: extra.date,
            startTime: extra.startTime,
            endTime: extra.endTime,
            room: extra.room
        },
        isCompleted: !!completion,
        isPaid: !!completion?.isPaid,
        isExtra: true
      } as TodayClass;
    });

    return [...regularToday, ...extrasToday].sort((a, b) => 
      a.currentSlot.startTime.localeCompare(b.currentSlot.startTime)
    );
  }, [currentTime, allClasses, todayCompletions, extraSessionsToday]);

  // Derived stats
  const stats = useMemo(() => {
    const totalPending = allClasses.reduce((acc, curr) => acc + (curr.sessionsSinceLastPayment || 0), 0);
    const totalSessions = allClasses.reduce((acc, curr) => acc + (curr.completedSessions || 0), 0);
    const tenureMonths = teacherData?.createdAt ? Math.floor((new Date().getTime() - teacherData.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24 * 30.44)) : 0;
    
    return {
      totalStudents: allClasses.reduce((acc, curr) => acc + (curr.studentCount || 0), 0),
      activeClasses: allClasses.length,
      completedToday: todayCompletions.length,
      totalSessions,
      cyclesCompletedYear: salariesCount,
      pendingSessions: totalPending,
      tenureLabel: tenureMonths < 12 ? `${tenureMonths} Months` : `${(tenureMonths / 12).toFixed(1)} Years`
    };
  }, [allClasses, todayCompletions, salariesCount, teacherData]);

  const toggleClassCompletion = async (classItem: TodayClass) => {
    if (!user?.uid) return;
    
    // AUDIT LOCK: Prevent reverting financially settled sessions
    if (classItem.isPaid) {
        toast.error("Audit Locked: This session has been financially settled and cannot be reverted.");
        return;
    }

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const startTimeSafe = (classItem.currentSlot?.startTime || '00-00').replace(/:/g, '-');
    const completionId = `${classItem.id}_${todayStr}_${startTimeSafe}`;
    const isCurrentlyCompleted = classItem.isCompleted;

    const now = new Date();
    const [startH, startM] = (classItem.currentSlot?.startTime || "00:00").split(':').map(Number);
    const slotStartTime = (startH * 60) + startM;
    const currentTimeMinutes = (now.getHours() * 60) + now.getMinutes();
    const isFuture = currentTimeMinutes < slotStartTime;

    if (isFuture && !isCurrentlyCompleted) {
        toast.error("This session hasn't started yet.");
        return;
    }

    try {
      const currentDay = format(new Date(), "EEEE").toLowerCase();
      const completionRef = doc(db, "session_completions", completionId);
      const classRef = doc(db, "classes", classItem.id);

      if (isCurrentlyCompleted) {
        // Read FRESH counter AND completion data to handle pending salary reverts
        const [freshClassSnap, completionSnap] = await Promise.all([
            getDoc(classRef),
            getDoc(completionRef)
        ]);
        
        const completionData = completionSnap.data();
        const freshPending = freshClassSnap.data()?.sessionsSinceLastPayment || 0;
        const batch = writeBatch(db);

        // Calculate net delta for sessionsSinceLastPayment
        // Default: just decrement by 1 (normal revert), but don't go below 0
        let pendingDelta = freshPending > 0 ? -1 : 0;

        // If this session was part of a pending salary request, UNDO the entire salary
        if (completionData?.salaryId) {
            const salaryRef = doc(db, "salaries", completionData.salaryId);
            const salarySnap = await getDoc(salaryRef);
            
            if (salarySnap.exists() && salarySnap.data().status === "pending") {
                const sessionsCovered = salarySnap.data().sessionsConducted || 0;
                
                // Net delta: restore all sessions from salary, minus the one being reverted
                // e.g. salary covered 8 sessions, counter is currently 0 → 0 + (8-1) = 7
                pendingDelta = sessionsCovered - 1;

                // Delete the pending salary request
                batch.delete(salaryRef);

                // Clear salaryId from ALL completions that were part of this salary
                const otherCompletionsQ = query(
                    collection(db, "session_completions"),
                    where("salaryId", "==", completionData.salaryId)
                );
                const otherCompletionsSnap = await getDocs(otherCompletionsQ);
                otherCompletionsSnap.docs.forEach(d => {
                    batch.update(doc(db, "session_completions", d.id), {
                        salaryId: deleteField()
                    });
                });
            }
        }
        
        // Single atomic update to class document (CRITICAL: only one batch.update per doc per field)
        batch.delete(completionRef);
        batch.update(classRef, {
            completedSessions: increment(-1),
            sessionsSinceLastPayment: increment(pendingDelta)
        });

        await batch.commit();
        toast.success(`Session for ${classItem.name} reverted.`);
      } else {
        await setDoc(completionRef, {
            classId: classItem.id,
            className: classItem.name,
            teacherId: user.uid,
            teacherName: teacherData?.name || "Teacher",
            date: todayStr,
            dayOfWeek: currentDay,
            timestamp: serverTimestamp(),
            startTime: classItem.currentSlot?.startTime || "--:--",
            endTime: classItem.currentSlot?.endTime || "--:--",
            subject: classItem.subject,
            grade: classItem.grade,
            studentCount: classItem.studentCount || 0,
            isPaid: false,
            day: new Date().getDate(),
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
        });
        await updateDoc(classRef, {
            completedSessions: increment(1),
            sessionsSinceLastPayment: increment(1)
        });
        toast.success(`Session for ${classItem.name} completed!`);

        // Check for automatic salary request (milestone)
        try {
            const classQ = query(collection(db, "classes"), where("teacherId", "==", user.uid));
            const freshClassesSnap = await getDocs(classQ);
            const freshClasses = freshClassesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Class));
            const hasReachedMilestone = freshClasses.some(c => 
                (c.sessionsSinceLastPayment || 0) >= (c.sessionsPerCycle || 8)
            );

            if (hasReachedMilestone) {
                const payroll = await processTeacherPayroll(user.uid, teacherData?.name || "Teacher", freshClasses, undefined, completionId);
                if (payroll.success) {
                    toast.success("Milestone reached! Salary request generated.", { icon: "💰", duration: 5000 });
                }
            }
        } catch (err) {
            console.error("Auto-payroll check failed:", err);
        }
      }
    } catch (error) {
       console.error("Sync Error:", error);
       toast.error("Process failed.");
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
             <Skeleton variant="text" width="200px" height="32px" />
             <Skeleton variant="rect" width="100px" height="40px" className="rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {[1,2,3,4].map(i => <Skeleton key={i} variant="rect" width="100%" height="90px" className="rounded-3xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <Skeleton variant="rect" width="100%" height="400px" className="rounded-[32px]" />
           <Skeleton variant="rect" width="100%" height="400px" className="rounded-[32px]" />
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Total Students", value: stats.totalStudents, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Sessions Tracked", value: stats.totalSessions, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Cycles (Current Year)", value: stats.cyclesCompletedYear, icon: Activity, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Today's Work", value: `${stats.completedToday} Done`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* 🏷️ Dynamic Workspace Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 shadow-2xl shadow-slate-200/40 p-1">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -mr-48 -mt-48 transition-transform duration-1000 group-hover:scale-110"></div>
        <div className="bg-slate-50/50 rounded-[2.3rem] p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
               <div className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg shadow-indigo-100">
                  Faculty OS v2.0
               </div>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Terminal</span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
                {getGreeting()}, <span className="text-indigo-600">{teacherData?.name?.split(' ')[0] || 'Professor'}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                <div className="flex items-center gap-2 text-slate-500 font-bold text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                   <Calendar className="w-4 h-4 text-indigo-500" />
                   {format(currentTime, "EEEE, MMMM dd, yyyy")}
                </div>
                <div className="flex items-center gap-2 text-slate-500 font-bold text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                   <Clock className="w-4 h-4 text-indigo-500" />
                   {format(currentTime, "hh:mm a")}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-end lg:self-center">
            {latestSalary && (
              <div className="bg-emerald-50/50 border border-emerald-100 px-5 py-3 rounded-2xl flex items-center gap-4 group hover:bg-emerald-100/50 transition-all">
                <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                   <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-emerald-600/80 uppercase tracking-widest leading-none mb-1">Last Settlement</p>
                  <p className="text-sm font-black text-slate-800 leading-none">LKR {latestSalary.netSalary?.toLocaleString()}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Link href="/teacher/timetable" className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-xl hover:-translate-y-1" title="Matrix View">
                 <Calendar className="w-5 h-5" />
              </Link>
              <Link href="/teacher/ledger" className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-xl shadow-indigo-100 hover:shadow-2xl">
                 <Activity className="w-4 h-4" /> Operations Hub
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* 🚀 Main Operational Column */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Quick HUD Stats - Wide Layout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card, idx) => (
              <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-3 group hover:border-indigo-200 hover:shadow-xl transition-all duration-500 relative overflow-hidden">
                <div className={`absolute -right-2 -bottom-2 w-12 h-12 opacity-5 group-hover:scale-150 transition-transform duration-700 ${card.color}`}>
                   <card.icon className="w-full h-full" />
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 shadow-sm ${card.bg} ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black tracking-[0.15em] uppercase text-slate-400 opacity-80">{card.title}</p>
                  <p className="text-xl font-black text-slate-900 tracking-tight">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Today's Academic Feed */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                 <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                 <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">Today's Session Feed</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time instructional timeline</p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency:</span>
                 <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                    {Math.round((todayCompletions.length / (todayClasses.length || 1)) * 100)}%
                 </span>
              </div>
            </div>

            <div className="space-y-4">
              {todayClasses.length > 0 ? todayClasses.map((item, idx) => {
                const nowMinutes = (currentTime.getHours() * 60) + currentTime.getMinutes();
                const [sH, sM] = (item.currentSlot?.startTime || "00:00").split(':').map(Number);
                const sTime = (sH * 60) + sM;
                const isPreemptive = nowMinutes < sTime;
                const isActive = !isPreemptive && !item.isCompleted;

                return (
                  <div key={`${item.id}-${idx}`} className={`relative group`}>
                    {/* Connection Line */}
                    {idx !== todayClasses.length - 1 && (
                      <div className="absolute left-[39px] top-16 bottom-[-16px] w-[2px] bg-slate-100 group-hover:bg-indigo-100 transition-colors hidden md:block"></div>
                    )}
                    
                    <div className={`flex flex-col md:flex-row gap-4 md:items-center bg-white p-4 md:p-6 rounded-[2rem] border transition-all duration-500 ${item.isCompleted ? 'border-slate-100 bg-slate-50/30' : isActive ? 'border-indigo-200 shadow-xl shadow-indigo-100/20 ring-1 ring-indigo-50' : 'border-slate-100 shadow-sm'}`}>
                      
                      {/* Timeline Marker */}
                      <div className="hidden md:flex flex-col items-center justify-center min-w-[80px] text-center">
                        <p className={`text-sm font-black tabular-nums transition-colors ${item.isCompleted ? 'text-slate-400' : isActive ? 'text-indigo-600' : 'text-slate-800'}`}>
                          {item.currentSlot?.startTime}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">START</p>
                      </div>

                      {/* Status Icon */}
                      <div className={`w-12 h-12 rounded-[1.25rem] hidden md:flex items-center justify-center shrink-0 border transition-all duration-500 ${item.isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-500 shadow-lg shadow-emerald-50' : isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-200 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                        {item.isCompleted ? <CheckCircle2 className="w-6 h-6" /> : isActive ? <Activity className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                           {item.isExtra && <span className="text-[8px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-md tracking-widest uppercase shadow-sm">Extra Session</span>}
                           {item.isPaid && <span className="text-[8px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md tracking-widest uppercase shadow-sm flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> Settled</span>}
                           <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${item.isCompleted ? 'text-emerald-600' : isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                              {item.isCompleted ? 'Module Finalized' : isActive ? 'Instruction in Progress' : 'Scheduled Segment'}
                           </span>
                        </div>
                        
                        <div>
                           <h4 className={`text-lg font-black tracking-tight leading-none ${item.isCompleted ? 'text-slate-400 line-through decoration-emerald-500/30' : 'text-slate-900'}`}>
                             {item.name}
                           </h4>
                           <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-bold text-slate-500">
                              <span className="flex items-center gap-1.5 uppercase tracking-widest">
                                 <GraduationCap className="w-3.5 h-3.5 text-indigo-400" /> Grade {item.grade}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                              <span className="flex items-center gap-1.5 uppercase tracking-widest">
                                 <MapPin className="w-3.5 h-3.5 text-rose-400" /> {item.currentSlot?.room}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                              <span className="flex items-center gap-1.5 uppercase tracking-widest italic text-slate-400">
                                 {item.subject}
                              </span>
                           </div>
                        </div>
                      </div>

                      {/* Actions Area */}
                      <div className="flex items-center justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-50">
                        {item.isPaid ? (
                           <div className="px-4 py-2 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                              Locked Archive
                           </div>
                        ) : item.isCompleted ? (
                          <button 
                              onClick={() => toggleClassCompletion(item)}
                              className="px-4 py-2 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                          >
                             <RotateCcw className="w-3.5 h-3.5" /> Revert
                          </button>
                        ) : (
                          <button 
                              onClick={() => toggleClassCompletion(item)}
                              disabled={isPreemptive}
                              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isPreemptive ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-slate-900 active:scale-95 flex items-center gap-2 cursor-pointer'}`}
                          >
                             {isPreemptive ? <Lock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                             Finalize Session
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="bg-white border-2 border-dashed border-slate-100 rounded-[3rem] py-20 text-center space-y-4">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                      <Calendar className="w-10 h-10" />
                   </div>
                   <div className="space-y-1">
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Operational Directives</p>
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Instructional calendar is clear for today.</p>
                   </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 📊 Insights & Metadata Column */}
        <div className="xl:col-span-4 space-y-8">
          
          {/* Active Academic Registry */}
          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col group/registry">
             <div className="px-6 py-5 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <div>
                   <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">Active Inventories</h3>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Cycle progress matrix</p>
                </div>
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                   <Layers className="w-4 h-4" />
                </div>
             </div>
             <div className="p-4 space-y-3">
               {allClasses.map((cls) => {
                  const cycleProgress = Math.max(0, cls.sessionsSinceLastPayment || 0);
                  const cycleBenchmark = cls.sessionsPerCycle || 8;
                  const progressPct = Math.min(100, (cycleProgress / cycleBenchmark) * 100);
                  return (
                    <div key={cls.id} className="p-4 bg-slate-50/50 rounded-2xl border border-white hover:border-indigo-100 transition-all group/item">
                       <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 bg-white rounded-lg shadow-sm border border-slate-100 flex items-center justify-center text-[10px] font-black text-indigo-600">
                                {cls.grade.charAt(0)}
                             </div>
                             <div>
                                <h4 className="font-black text-slate-800 text-[11px] uppercase truncate max-w-[120px]">{cls.name}</h4>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{cls.subject}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-900 tabular-nums">{cycleProgress} / {cycleBenchmark}</p>
                             <p className="text-[8px] font-black uppercase text-indigo-500 tracking-widest">{Math.round(progressPct)}%</p>
                          </div>
                       </div>
                       <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-slate-100/50">
                          <div className={`h-full transition-all duration-1000 ${progressPct > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`} style={{ width: `${progressPct}%` }}></div>
                       </div>
                    </div>
                  );
               })}
               {allClasses.length === 0 && (
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center py-8">No active assignments</p>
               )}
             </div>
          </section>

          {/* 💰 Financial Health Hub */}
          <section className="bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden relative group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16"></div>
             <div className="px-6 py-5 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div>
                   <h3 className="text-xs font-black text-white tracking-wider uppercase">Financial Health Hub</h3>
                   <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em] mt-0.5">Accruals & Milestone Tracking</p>
                </div>
                <Wallet className="w-4 h-4 text-emerald-400" />
             </div>
             <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Pending Sessions</p>
                      <h4 className="text-2xl font-black text-white">{stats.pendingSessions}</h4>
                      <p className="text-[7px] font-bold text-emerald-400 uppercase tracking-tighter">Ready for cycle</p>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Yearly Settlements</p>
                      <h4 className="text-2xl font-black text-white">{stats.cyclesCompletedYear}</h4>
                      <p className="text-[7px] font-bold text-indigo-400 uppercase tracking-tighter">Cycles disbursed</p>
                   </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                   <div className="flex justify-between items-center mb-2">
                      <p className="text-[9px] font-black text-white/60 uppercase tracking-widest">Next Milestone Velocity</p>
                      <p className="text-[10px] font-black text-indigo-400">
                        {Math.round((stats.pendingSessions / (allClasses.length * 8 || 1)) * 100)}%
                      </p>
                   </div>
                   <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (stats.pendingSessions / (allClasses.length * 8 || 1)) * 100)}%` }}></div>
                   </div>
                </div>
             </div>
             <div className="px-6 py-4 bg-white/5 text-center group-hover:bg-white/10 transition-colors">
                <Link href="/teacher/salary" className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                   Analyze Detailed Ledger →
                </Link>
             </div>
          </section>

          {/* 🎓 Professional Footprint Card */}
          <div className="bg-indigo-600 rounded-[2rem] p-6 shadow-xl shadow-indigo-100 relative overflow-hidden group">
             <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
             <div className="space-y-4 relative z-10">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white border border-white/10">
                    <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-1">Professional Footprint</p>
                   <h4 className="text-2xl font-black text-white tracking-tight italic underline decoration-indigo-400 decoration-2 underline-offset-4">Verified Professional</h4>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                   <div>
                      <p className="text-[8px] font-black text-indigo-100 uppercase tracking-widest opacity-80">Lifetime Sessions</p>
                      <p className="text-lg font-black text-white">{stats.totalSessions}</p>
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-indigo-100 uppercase tracking-widest opacity-80">Faculty Tenure</p>
                      <p className="text-lg font-black text-white">{stats.tenureLabel}</p>
                   </div>
                </div>
                <div className="pt-2">
                   <p className="text-[8px] font-black text-white/60 uppercase tracking-widest leading-relaxed">
                      Maintaining high institutional standards since {teacherData?.createdAt ? format(teacherData.createdAt.toDate(), "MMMM yyyy") : "Initial Enrollment"}.
                   </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
