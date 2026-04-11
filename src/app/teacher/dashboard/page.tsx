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
  deleteDoc,
  getDoc,
  Timestamp,
  getDocs
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Teacher, Salary } from "@/types/models";
import { format } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatTime } from "@/lib/formatters";
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
  isPaid?: boolean;
}

interface TodayClass extends Class {
  currentSlot: {
    dayOfWeek: string;
    startTime: string;
    room: string;
  };
  isCompleted: boolean;
  isPaid?: boolean;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [todayCompletions, setTodayCompletions] = useState<SessionCompletion[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<SessionCompletion[]>([]);
  const [latestSalary, setLatestSalary] = useState<Salary | null>(null);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
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

    return () => {
        unsubscribeTeacher();
        unsubscribeClasses();
        unsubscribeTodayComp();
        unsubscribeRecentComp();
        unsubscribeSalary();
    };
  }, [user]);

  // Derived state for Today's specific sessions — uses today-specific completions
  const todayClasses = useMemo(() => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const currentDay = format(currentTime, "EEEE").toLowerCase();
    
    const sessions: TodayClass[] = [];
    allClasses.forEach(c => {
       const todaySlots = c.schedules?.filter(s => s.dayOfWeek.toLowerCase() === currentDay) || [];
       todaySlots.forEach(slot => {
          const completion = todayCompletions.find(h => 
             h.classId === c.id && 
             h.date === todayStr && 
             h.startTime === slot.startTime
          );
          sessions.push({
             ...c,
             currentSlot: slot,
             isCompleted: !!completion,
             isPaid: !!completion?.isPaid
          });
       });
    });

    return sessions.sort((a, b) => a.currentSlot.startTime.localeCompare(b.currentSlot.startTime));
  }, [allClasses, todayCompletions, currentTime]);

  // Derived stats
  const stats = useMemo(() => {
    return {
      totalStudents: allClasses.reduce((acc, curr) => acc + (curr.studentCount || 0), 0),
      activeClasses: allClasses.length,
      completedToday: todayCompletions.length
    };
  }, [allClasses, todayCompletions]);

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
        // FIX: Read FRESH counter from Firestore to avoid stale state causing negatives
        const freshClassSnap = await getDoc(classRef);
        const freshPending = freshClassSnap.data()?.sessionsSinceLastPayment || 0;
        
        await deleteDoc(completionRef);
        await updateDoc(classRef, {
            completedSessions: increment(-1),
            sessionsSinceLastPayment: increment(freshPending > 0 ? -1 : 0)
        });
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
                const payroll = await processTeacherPayroll(user.uid, teacherData?.name || "Teacher", freshClasses);
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
    { title: "My Students", value: stats.totalStudents, icon: Users, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: "Your Classes", value: stats.activeClasses, icon: Layers, color: "text-purple-600", bg: "bg-purple-100" },
    { title: "Today's Work", value: `${stats.completedToday} Done`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Last Salary", value: latestSalary ? `LKR ${latestSalary.netAmount.toLocaleString()}` : "LKR 0", icon: Wallet, color: "text-indigo-600", bg: "bg-indigo-100" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Premium Institutional Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3 mb-1">
             <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
             <p className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600/80">Faculty Portal Access</p>
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">
            {getGreeting()}, <span className="text-indigo-600 italic">{teacherData?.name?.split(' ')[0] || 'Professor'}</span>
          </h2>
          <div className="flex items-center gap-3 text-slate-400">
             <span className="text-[10px] font-black uppercase tracking-widest">{format(currentTime, "EEEE, MMMM dd")}</span>
             <div className="w-1 h-1 rounded-full bg-slate-200"></div>
             <div className="flex items-center gap-1.5 text-slate-500 font-bold text-[10px] bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                <Clock className="w-3 h-3 text-indigo-500 animate-pulse" /> {format(currentTime, "hh:mm a")}
             </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <Link href="/teacher/timetable" className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm uppercase tracking-widest hover:border-indigo-200 group">
                <Calendar className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" /> Full Schedule
            </Link>
            <Link href="/teacher/salary" className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black hover:bg-indigo-700 transition-all flex items-center gap-2.5 shadow-xl shadow-indigo-600/20 uppercase tracking-widest group">
                <Wallet className="w-4 h-4 text-indigo-200 group-hover:rotate-12 transition-transform" /> Financials
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-xl hover:translate-y-[-4px] transition-all duration-500 group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4`}>
                <card.icon className="w-full h-full" />
            </div>
            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 ${card.bg} ${card.color} shadow-lg shadow-current/10`}>
              <card.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400 mb-0.5">{card.title}</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Classes Summary with Cycle Progression */}
        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden flex flex-col group/table hover:border-indigo-100 transition-all duration-700">
          <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 tracking-[0.15em] uppercase text-sm flex items-center gap-3">
                <Activity className="w-5 h-5 text-indigo-600" /> My Registry
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active assignment lifecycle tracking</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-50/50 flex items-center justify-center text-slate-400 border border-slate-100">
               <Layers className="w-6 h-6" />
            </div>
          </div>
          <div className="p-0 flex-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Classification</th>
                  <th className="px-8 py-5 text-center">Enrollment</th>
                  <th className="px-8 py-5 text-right">Cycle Progression</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allClasses.map((cls) => {
                  const cycleProgress = Math.max(0, cls.sessionsSinceLastPayment || 0);
                  const cycleBenchmark = cls.sessionsPerCycle || 8;
                  const progressPct = Math.min(100, (cycleProgress / cycleBenchmark) * 100);
                  return (
                    <tr key={cls.id} className="hover:bg-indigo-50/20 transition-all duration-500 group/row">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all duration-700 shadow-sm text-sm uppercase">
                              {cls.name.charAt(0)}
                           </div>
                           <div>
                              <p className="font-black text-slate-800 text-sm tracking-tight group-hover/row:text-indigo-600 transition-colors">{cls.name}</p>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cls.subject} • Grade {cls.grade}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                         <span className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-[0.1em] border border-slate-200">
                            {cls.studentCount || 0}
                         </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                         <div className="flex flex-col items-end gap-1.5">
                            <span className="text-2xl font-black text-indigo-600 tracking-tighter tabular-nums">
                               {cycleProgress}<span className="text-sm text-slate-300 font-bold">/{cycleBenchmark}</span>
                            </span>
                            <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                               <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${progressPct}%` }}></div>
                            </div>
                         </div>
                      </td>
                    </tr>
                  );
                })}
                {allClasses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-8 py-24 text-center">
                       <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-4">
                          <Activity className="w-8 h-8" />
                       </div>
                       <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No classifications assigned.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden flex flex-col hover:border-indigo-100 transition-all duration-700">
          <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 tracking-[0.15em] uppercase text-sm flex items-center gap-3">
                <Calendar className="w-5 h-5 text-indigo-600" /> Daily Matrix
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Institutional time synchronized</p>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] shadow-sm border ${todayClasses.some(c => !c.isCompleted) ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`}>
                {todayClasses.filter(c => !c.isCompleted).length} Remaining
            </div>
          </div>
          <div className="p-6 flex-1 bg-slate-50/20">
            <div className="space-y-4">
               {todayClasses.length > 0 ? todayClasses.map((item, idx) => (
                 <div key={`${item.id}-${idx}`} className={`group p-6 rounded-[2.5rem] transition-all duration-500 border relative shadow-xl ${item.isCompleted ? 'bg-white border-indigo-100 grayscale hover:grayscale-0' : 'bg-white border-white hover:border-indigo-200'}`}>
                    <div className="flex justify-between items-start mb-5">
                       <div className="flex items-center gap-3">
                          <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all duration-500 ${item.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm'}`}>
                              {formatTime(item.currentSlot?.startTime || '--:--')}
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <MapPin size={12} className="text-orange-500" /> {item.currentSlot?.room}
                          </span>
                       </div>
                       {item.isPaid ? (
                          <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                             <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Settled</span>
                             <Lock className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                       ) : item.isCompleted ? (
                          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                       ) : (
                          <div className="flex h-3 w-3 relative">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-600"></span>
                          </div>
                       )}
                    </div>
                    
                    <h4 className={`font-black text-base tracking-tight uppercase mb-1 transition-colors ${item.isCompleted ? 'text-slate-400 group-hover:text-indigo-900' : 'text-slate-800'}`}>{item.name}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">{item.subject} • Grade {item.grade}</p>
                    
                    <div className="flex gap-2">
                      {(() => {
                         const nowMinutes = (currentTime.getHours() * 60) + currentTime.getMinutes();
                         const [sH, sM] = (item.currentSlot?.startTime || "00:00").split(':').map(Number);
                         const sTime = (sH * 60) + sM;
                         const isPreemptive = nowMinutes < sTime;

                         if (item.isPaid) {
                            return (
                               <button disabled className="w-full py-3 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2.5 cursor-not-allowed grayscale">
                                  <Lock className="w-4 h-4" /> Audit Locked
                               </button>
                            );
                         }

                         if (item.isCompleted) {
                            return (
                               <button 
                                   onClick={() => toggleClassCompletion(item)}
                                   className="w-full py-3 bg-slate-50 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2.5 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 border border-slate-100 transition-all duration-500"
                               >
                                  <RotateCcw className="w-4 h-4" /> Undo Completion
                               </button>
                            );
                         }

                         if (isPreemptive) {
                            return (
                               <button disabled className="w-full py-3 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2.5 cursor-not-allowed border border-slate-200">
                                  <Clock className="w-4 h-4" /> Pending Start
                               </button>
                            );
                         }

                         return (
                            <button 
                                onClick={() => toggleClassCompletion(item)}
                                className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2.5 hover:bg-slate-900 transition-all duration-500 shadow-xl shadow-indigo-600/20 active:scale-95"
                            >
                               <CheckCircle2 className="w-4 h-4" /> Mark as Done
                            </button>
                         );
                      })()}
                    </div>
                 </div>
               )) : (
                 <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-50/80 rounded-[3rem] border-2 border-dashed border-slate-200">
                    <Calendar className="w-10 h-10 text-slate-200 mb-4" />
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No Assignments Record Today</p>
                 </div>
               )}
            </div>
            
            {todayClasses.length > 0 && (
              <div className="mt-8 pt-8 border-t border-slate-100">
                <Link href="/teacher/timetable" className="flex items-center justify-center gap-3 py-4 bg-white hover:bg-slate-900 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all duration-500 border border-slate-200 shadow-sm group">
                   Visit Full Matrix <Calendar className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
         <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                <GraduationCap className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mb-1">Teaching Progress</p>
               <h4 className="text-xl font-black">Overall Average Rank: <span className="text-indigo-400">98.4%</span></h4>
            </div>
         </div>
      </div>
    </div>
  );
}
