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
  RotateCcw
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
  deleteDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Teacher, Salary } from "@/types/models";
import { format } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";

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
  room: string;
  subject: string;
  grade: string;
  studentCount?: number;
}

interface TodayClass extends Class {
  currentSlot: {
    dayOfWeek: string;
    startTime: string;
    room: string;
  };
  isCompleted: boolean;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
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
    
    const tRef = doc(db, "teachers", user.uid);
    const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid));
    const completionsRef = collection(db, "session_completions");
    const qRecentComp = query(
        completionsRef, 
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

    const unsubscribeRecent = onSnapshot(qRecentComp, (snap) => {
        const history = snap.docs.map(d => ({ ...d.data(), id: d.id } as SessionCompletion));
        setCompletions(history);
    });

    const unsubscribeSalary = onSnapshot(salaryQuery, (snap) => {
        if (!snap.empty) setLatestSalary({ id: snap.docs[0].id, ...snap.docs[0].data() } as Salary);
    });

    return () => {
        unsubscribeTeacher();
        unsubscribeClasses();
        unsubscribeRecent();
        unsubscribeSalary();
    };
  }, [user]);

  // Derived state for Today's specific sessions
  const todayClasses = useMemo(() => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const currentDay = format(currentTime, "EEEE").toLowerCase();
    
    const sessions: TodayClass[] = [];
    allClasses.forEach(c => {
       const todaySlots = c.schedules?.filter(s => s.dayOfWeek.toLowerCase() === currentDay) || [];
       todaySlots.forEach(slot => {
          sessions.push({
             ...c,
             currentSlot: slot,
             isCompleted: completions.some(h => 
                h.classId === c.id && 
                h.date === todayStr && 
                h.startTime === slot.startTime
             )
          });
       });
    });

    return sessions.sort((a, b) => a.currentSlot.startTime.localeCompare(b.currentSlot.startTime));
  }, [allClasses, completions, currentTime]);

  // Derived stats for the header
  const stats = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return {
      totalStudents: allClasses.reduce((acc, curr) => acc + (curr.studentCount || 0), 0),
      activeClasses: allClasses.length,
      completedToday: completions.filter(h => h.date === todayStr).length
    };
  }, [allClasses, completions]);

  const toggleClassCompletion = async (classItem: any) => {
    if (!user?.uid) return;
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const startTimeSafe = (classItem.currentSlot?.startTime || '00-00').replace(/:/g, '-');
    const completionId = `${classItem.id}_${todayStr}_${startTimeSafe}`;
    const isCurrentlyCompleted = classItem.isCompleted;

    // Optimistic Update: Update local completions state immediately
    const optimisticCompletion = {
      classId: classItem.id,
      date: todayStr,
      startTime: classItem.currentSlot?.startTime || "--:--",
      id: completionId
    } as SessionCompletion;

    if (isCurrentlyCompleted) {
       setCompletions(prev => prev.filter(c => c.id !== completionId));
    } else {
       setCompletions(prev => [optimisticCompletion, ...prev]);
    }

    try {
      const currentDay = format(new Date(), "EEEE").toLowerCase();
      const completionRef = doc(db, "session_completions", completionId);
      const classRef = doc(db, "classes", classItem.id);

      if (isCurrentlyCompleted) {
        // Mark as Incomplete (Undo)
        await deleteDoc(completionRef);
        await updateDoc(classRef, {
            completedSessions: increment(-1),
            sessionsSinceLastPayment: increment(-1)
        });
        toast.success(`Session for ${classItem.name} marked as incomplete.`);
      } else {
        // Mark as Completed
        await setDoc(completionRef, {
            classId: classItem.id,
            className: classItem.name,
            teacherId: user.uid,
            teacherName: teacherData?.name || "Teacher",
            date: todayStr,
            dayOfWeek: currentDay,
            timestamp: serverTimestamp(),
            startTime: classItem.currentSlot?.startTime || "--:--",
            room: classItem.currentSlot?.room || "---",
            subject: classItem.subject,
            grade: classItem.grade,
            studentCount: classItem.studentCount || 0
        });
        await updateDoc(classRef, {
            completedSessions: increment(1),
            sessionsSinceLastPayment: increment(1)
        });
        toast.success(`Session for ${classItem.name} completed successfully!`);
      }
    } catch (error) {
       // Revert optimistic update on failure
       console.error("Sync Error:", error);
       toast.error("Process failed. Syncing status...");
       // The onSnapshot will eventually correct the state
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {getGreeting()}, <span className="text-indigo-600">{teacherData?.name?.split(' ')[0] || 'Teacher'}</span>
          </h2>
          <p className="text-sm text-slate-500 font-bold tracking-tight uppercase tracking-widest text-[10px]">
            {format(currentTime, "EEEE, MMMM dd, yyyy")} • {format(currentTime, "hh:mm a")}
          </p>
        </div>
        <div className="flex gap-2">
            <Link href="/teacher/timetable" className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm uppercase tracking-widest">
                <Calendar className="w-4 h-4" /> Timetable
            </Link>
            <Link href="/teacher/salary" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 uppercase tracking-widest">
                <Wallet className="w-4 h-4" /> My Wallet
            </Link>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${card.bg} ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">{card.title}</p>
              <p className="text-xl font-black text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: My Classes Summary */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 tracking-tight uppercase text-sm">My Classes</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active assignments in the registry</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
               <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="p-0 flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                <tr>
                  <th className="px-5 py-4">Class Identification</th>
                  <th className="px-5 py-4 text-center">Students</th>
                  <th className="px-5 py-4 text-right">Progression</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-5 py-5">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            {cls.name.charAt(0)}
                         </div>
                         <div>
                            <p className="font-black text-slate-800 text-sm tracking-tight">{cls.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cls.subject} • Grade {cls.grade}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-5 py-5 text-center">
                       <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {cls.studentCount || 0} Reg.
                       </span>
                    </td>
                    <td className="px-5 py-5 text-right">
                       <div className="flex flex-col items-end gap-1">
                          <span className="text-xl font-black text-indigo-600 tracking-tight">
                             {cls.completedSessions || 0}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                             {cls.sessionsSinceLastPayment || 0}/8 to Next Pay
                          </span>
                       </div>
                    </td>
                  </tr>
                ))}
                {allClasses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-8 py-20 text-center">
                       <Activity className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                       <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active classifications found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Today's Schedule */}
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 tracking-tight uppercase text-sm">Today's Schedule</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active operational status</p>
            </div>
            <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${todayClasses.some(c => !c.isCompleted) ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {todayClasses.filter(c => !c.isCompleted).length} Remaining
            </div>
          </div>
          <div className="p-4 flex-1">
            <div className="space-y-3">
               {todayClasses.length > 0 ? todayClasses.map((item, idx) => (
                 <div key={`${item.id}-${idx}`} className={`group p-4 rounded-[2rem] transition-all border relative shadow-sm ${item.isCompleted ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                       <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${item.isCompleted ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                              {item.currentSlot?.startTime || '--:--'}
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                             <MapPin size={10} className="text-orange-400" /> {item.currentSlot?.room}
                          </span>
                       </div>
                       {item.isCompleted ? (
                          <div className="flex items-center gap-1">
                              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mr-1">Finalized</span>
                              <CheckCircle className="w-4 h-4 text-indigo-600" />
                          </div>
                       ) : (
                          <div className="flex h-2 w-2 relative">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                          </div>
                       )}
                    </div>
                    
                    <h4 className={`font-black text-sm tracking-tight uppercase mb-1 ${item.isCompleted ? 'text-indigo-900' : 'text-slate-800'}`}>{item.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{item.subject} • Grade {item.grade}</p>
                    
                    <div className="flex gap-2 pt-2">
                      {!item.isCompleted ? (
                         <button 
                             onClick={() => toggleClassCompletion(item)}
                             className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md"
                         >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Done
                         </button>
                      ) : (
                        <button 
                            onClick={() => toggleClassCompletion(item)}
                            className="w-full py-2 bg-indigo-100 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 border border-transparent transition-all"
                        >
                           <RotateCcw className="w-3.5 h-3.5" /> Made a mistake? Mark Incomplete
                        </button>
                      )}
                    </div>
                 </div>
               )) : (
                 <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-100">
                    <Calendar className="w-8 h-8 text-slate-200 mb-3" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Operational Units Today</p>
                 </div>
               )}
            </div>
            
            {todayClasses.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link href="/teacher/timetable" className="flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all border border-slate-100">
                   View Full Timetable <ArrowRightIcon className="w-4 h-4 ml-1" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Micro Analytics Bar */}
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
         <div className="flex items-center gap-8">
            <div className="text-center">
               <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Attendance Rate</p>
               <p className="text-sm font-black">92%</p>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-center">
               <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Sync Status</p>
               <p className="text-sm font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                  Real-Time
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}

const ArrowRightIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
);
