"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, onSnapshot, getDoc, writeBatch, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CalendarDays, 
  MapPin, 
  Clock, 
  Zap,
  RotateCcw,
  CheckCircle2,
  History,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  Lock,
  Plus,
  Activity
} from "lucide-react";
import { Class, ClassSchedule } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { formatTime } from "@/lib/formatters";
import { format, addMonths, subMonths, isSameDay, isAfter, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from "date-fns";
import toast from "react-hot-toast";
import { processTeacherPayroll } from "@/lib/payroll";
import ExtraSessionModal from "@/components/teacher/ExtraSessionModal";

interface SessionCompletion {
  classId: string;
  date: string;
  startTime: string;
  id: string;
  isPaid?: boolean;
}

interface TimetableSlot extends Partial<Class>, Partial<ClassSchedule> {
  classId: string;
  uniqueSlotId: string;
  isCompleted?: boolean;
  isPaid?: boolean;
  isExtra?: boolean;
  name: string;
  grade: string;
  subject: string;
  startTime: string;
  endTime: string;
  room: string;
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

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);
  
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);
  const brandColor = "#4f39f6";

  const selectedDayName = format(selectedDate, "eeee").toLowerCase();
  const currentDayName = format(currentTime, "eeee").toLowerCase();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    
    setLoading(true);
    const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
      setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      setLoading(false);
    });

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const qCompletions = query(
      collection(db, "session_completions"),
      where("teacherId", "==", user.uid),
      where("date", "==", dateStr)
    );
    const unsubCompletions = onSnapshot(qCompletions, (snap) => {
      setCompletions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SessionCompletion)));
    });

    const qExtras = query(
      collection(db, "extra_sessions"),
      where("teacherId", "==", user.uid),
      where("date", "==", dateStr)
    );
    const unsubExtras = onSnapshot(qExtras, (snap) => {
      setExtraSessions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExtraSession)));
    });

    return () => {
      unsubClasses();
      unsubCompletions();
      unsubExtras();
    };
  }, [user, selectedDate]);

  const toggleClassCompletion = async (classItem: Class, slot: TimetableSlot) => {
    if (!user?.uid) return;
    
    if (slot.isPaid) {
        toast.error("Audit Lock: This session has been financially settled and cannot be modified.");
        return;
    }

    const [startH, startM] = slot.startTime.split(':').map(Number);
    const slotDateTime = new Date(selectedDate);
    slotDateTime.setHours(startH, startM, 0, 0);

    const isFuture = isAfter(slotDateTime, currentTime);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const startTimeSafe = slot.startTime.replace(/:/g, '-');
    const completionId = `${classItem.id}_${dateStr}_${startTimeSafe}`;
    const isCurrentlyCompleted = completions.some(c => c.id === completionId);

    if (isFuture && !isCurrentlyCompleted) {
        toast.error("Process Blocked: Future session.");
        return;
    }

    try {
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
        let pendingDelta = freshPending > 0 ? -1 : 0;

        // If this session was part of a pending salary request, UNDO the entire salary
        if (completionData?.salaryId) {
            const salaryRef = doc(db, "salaries", completionData.salaryId);
            const salarySnap = await getDoc(salaryRef);
            
            if (salarySnap.exists() && salarySnap.data().status === "pending") {
                const sessionsCovered = salarySnap.data().sessionsConducted || 0;
                
                // Net delta: restore all sessions from salary, minus the one being reverted
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
        
        batch.delete(completionRef);
        batch.update(classRef, {
            completedSessions: increment(-1),
            sessionsSinceLastPayment: increment(pendingDelta)
        });

        await batch.commit();
        toast.success(`Session reverted.`);
      } else {
        await setDoc(completionRef, {
            classId: classItem.id,
            className: classItem.name,
            teacherId: user.uid,
            teacherName: classItem.teacherName || "Teacher",
            date: dateStr,
            dayOfWeek: format(selectedDate, "eeee").toLowerCase(),
            timestamp: serverTimestamp(),
            startTime: slot.startTime,
            endTime: slot.endTime,
            subject: classItem.subject,
            grade: classItem.grade,
            studentCount: classItem.studentCount || 0,
            isPaid: false,
            day: selectedDate.getDate(),
            month: selectedDate.getMonth() + 1,
            year: selectedDate.getFullYear()
        });
        await updateDoc(classRef, {
            completedSessions: increment(1),
            sessionsSinceLastPayment: increment(1)
        });
        toast.success(`Session completed!`);

        // Check for automatic salary request (milestone)
        try {
            const classQ = query(collection(db, "classes"), where("teacherId", "==", user.uid));
            const freshClassesSnap = await getDocs(classQ);
            const freshClasses = freshClassesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Class));
            const hasReachedMilestone = freshClasses.some(c => 
                (c.sessionsSinceLastPayment || 0) >= (c.sessionsPerCycle || 8)
            );
            if (hasReachedMilestone) {
                const payroll = await processTeacherPayroll(user.uid, classItem.teacherName || "Teacher", freshClasses, undefined, completionId);
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

  const regularSlots: TimetableSlot[] = classes.flatMap(cls => 
    (cls.schedules || []).map((schedule: ClassSchedule) => ({
      ...cls,
      ...schedule,
      classId: cls.id,
      uniqueSlotId: `${cls.id}-${schedule.dayOfWeek}-${schedule.startTime}`,
      isExtra: false
    }))
  );

  const extraSlots: TimetableSlot[] = extraSessions.map(extra => ({
    classId: extra.classId,
    name: extra.className, // Matches parent class name
    grade: extra.grade,
    subject: extra.subject,
    startTime: extra.startTime,
    endTime: extra.endTime,
    room: extra.room,
    dayOfWeek: extra.dayOfWeek,
    uniqueSlotId: extra.id,
    isExtra: true
  }));

  const allSlotsMerged = [...regularSlots, ...extraSlots];

  const filteredSlots: TimetableSlot[] = allSlotsMerged
    .filter(slot => slot.isExtra || (slot.dayOfWeek && slot.dayOfWeek.toLowerCase() === selectedDayName.toLowerCase()))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(slot => {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        const startTimeSafe = slot.startTime.replace(/:/g, '-');
        const completionId = `${slot.classId}_${dateStr}_${startTimeSafe}`;
        const completion = completions.find(c => c.id === completionId);
        return {
            ...slot,
            isCompleted: !!completion,
            isPaid: !!completion?.isPaid
        };
    });

  const isSlotLive = (slotDay: string, startTime: string, endTime: string) => {
    const dayMatches = isToday(selectedDate) && slotDay?.toLowerCase() === currentDayName.toLowerCase();
    if (!dayMatches) return false;

    const [nowH, nowM] = [currentTime.getHours(), currentTime.getMinutes()];
    const now = nowH * 60 + nowM;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    return now >= (startH * 60 + startM) && now <= (endH * 60 + endM);
  };

  const completedCount = filteredSlots.filter(s => s.isCompleted).length;
  const progressPercent = filteredSlots.length > 0 ? (completedCount / filteredSlots.length) * 100 : 0;

  // Calendar logic
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const handleJumpToToday = () => setSelectedDate(new Date());

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* 🧭 Temporal Controller */}
      <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-[2.5rem] p-2 md:p-3 shadow-2xl shadow-indigo-100/40 sticky top-4 z-50">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 pl-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
               <CalendarDays className="w-5 h-5" />
            </div>
            <div>
               <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">Temporal Matrix</h2>
               <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{format(selectedDate, "MMMM yyyy")}</p>
               </div>
            </div>
          </div>

          {/* 📅 Horizontal Week Scroller - High UX */}
          <div className="flex-1 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar px-4">
            {eachDayOfInterval({ 
              start: startOfWeek(selectedDate, { weekStartsOn: 1 }), 
              end: endOfWeek(selectedDate, { weekStartsOn: 1 }) 
            }).map((day, idx) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDay = isToday(day);
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center justify-center min-w-[70px] py-2.5 rounded-2xl transition-all duration-300 ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 -translate-y-1' : 'bg-white hover:bg-slate-50 text-slate-400 border border-slate-100'}`}
                >
                  <span className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>{format(day, "EEE")}</span>
                  <span className="text-sm font-black tabular-nums leading-none">{format(day, "dd")}</span>
                  {isTodayDay && !isSelected && <div className="w-1 h-1 bg-indigo-500 rounded-full mt-1.5"></div>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pr-2">
            <button
               onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
               className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-sm"
               title="Open Calendar"
            >
               <Calendar className="w-5 h-5" />
            </button>
            <button
               onClick={() => setSelectedDate(new Date())}
               className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${isToday(selectedDate) ? 'bg-slate-50 text-slate-300 pointer-events-none' : 'bg-slate-900 text-white hover:shadow-xl'}`}
            >
               Reset
            </button>
          </div>
        </div>
      </div>

      {isCalendarExpanded && (
        <div className="p-4 bg-white border border-slate-100 rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-500 relative z-40">
            <div className="flex items-center justify-between mb-4 px-4 pt-2">
               <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{format(selectedDate, "MMMM yyyy")}</h3>
               <div className="flex gap-2">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight className="w-4 h-4" /></button>
               </div>
            </div>
            <div className="grid grid-cols-7 border border-slate-50 rounded-2xl overflow-hidden shadow-inner">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                    <div key={day} className="py-3 text-center text-[7px] font-black uppercase text-slate-400 bg-slate-50/50">{day}</div>
                ))}
                {calendarDays.map((date) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isDayMonth = isSameMonth(date, selectedDate);
                    return (
                        <button 
                            key={date.toString()}
                            onClick={() => { setSelectedDate(date); setIsCalendarExpanded(false); }}
                            className={`h-12 flex flex-col items-center justify-center transition-all border-r border-b border-slate-50 last:border-r-0 ${!isDayMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-indigo-50/10'} ${isSelected ? 'bg-indigo-50/30' : ''}`}
                        >
                            <span 
                                className={`text-[10px] font-black tabular-nums transition-all ${isSelected ? 'text-indigo-600' : 'text-slate-800'} ${isToday(date) ? 'underline decoration-2 decoration-indigo-500 underline-offset-4' : ''}`}
                            >
                                {format(date, "d")}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
      )}

      {/* 🚀 High-Density Performance Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-2">
        <div className="lg:col-span-8 bg-white/60 border border-slate-100 rounded-[2rem] p-4 flex items-center gap-6 group hover:bg-white hover:shadow-xl transition-all duration-500">
           <div className="relative w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-2xl">
              <Activity className="w-5 h-5 text-indigo-600" />
              <svg className="absolute -inset-1 w-14 h-14" viewBox="0 0 100 100">
                 <circle className="text-slate-200 stroke-current opacity-20" strokeWidth="6" fill="transparent" r="45" cx="50" cy="50" />
                 <circle 
                    className="text-indigo-600 stroke-current transition-all duration-1000 ease-out" 
                    strokeWidth="6" 
                    strokeDasharray={282.7} 
                    strokeDashoffset={282.7 - (282.7 * progressPercent) / 100} 
                    strokeLinecap="round" 
                    fill="transparent" 
                    r="45" cx="50" cy="50" 
                 />
              </svg>
           </div>
           <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                 <div>
                    <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest leading-none">Day Accomplishment Rate</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">{completedCount} of {filteredSlots.length} Missions Finalized</p>
                 </div>
                 <span className="text-xs font-black text-indigo-600">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
              </div>
           </div>
        </div>

        <Link href="/teacher/ledger" className="lg:col-span-4 bg-slate-900 rounded-[2rem] p-4 flex items-center justify-between group hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-indigo-400 border border-white/5">
                 <History className="w-5 h-5" />
              </div>
              <div>
                 <p className="text-[10px] font-black text-white tracking-tight uppercase">Audit Logs</p>
                 <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mt-0.5">Historical verification</p>
              </div>
           </div>
           <ChevronRight className="w-4 h-4 text-white/20 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* 🔮 Matrix Operational Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
           <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight uppercase">Session Directive: <span className="text-indigo-600 lowercase font-bold">{format(selectedDate, "eeee, d")}</span></h4>
           </div>
           <button 
              onClick={() => setIsExtraModalOpen(true)}
              className="px-6 py-2.5 bg-white border border-slate-200 rounded-2xl text-[9px] font-black text-slate-700 uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2"
           >
              <Plus className="w-3.5 h-3.5" /> Extra Load
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
             [1, 2, 3].map(i => <Skeleton key={i} variant="rect" width="100%" height="220px" className="rounded-[2.5rem]" />)
          ) : filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const highlights = isSlotLive(slot.dayOfWeek, slot.startTime, slot.endTime);
              const [sH, sM] = (slot.startTime || "00:00").split(':').map(Number);
              const slotDT = new Date(selectedDate);
              slotDT.setHours(sH, sM, 0, 0);
              const isPreemptive = isAfter(slotDT, currentTime);

              return (
                <div 
                    key={slot.uniqueSlotId} 
                    className={`relative p-5 rounded-[2.5rem] border transition-all duration-700 flex flex-col gap-4 overflow-hidden group/slot ${
                        slot.isCompleted 
                        ? 'bg-slate-50/50 border-slate-100 opacity-80' 
                        : highlights 
                            ? 'bg-white border-indigo-200 shadow-[0_20px_50px_rgba(79,70,229,0.15)] ring-1 ring-indigo-50 scale-[1.02]' 
                            : 'bg-white border-slate-100 hover:border-indigo-100 hover:shadow-xl'
                    }`}
                >
                  {/* Glass Decorator */}
                  {highlights && <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16 animate-pulse"></div>}
                  
                  <div className="flex items-center justify-between relative z-10">
                    <div className={`px-4 py-2 rounded-xl flex items-center gap-3 border ${highlights ? 'bg-indigo-600 text-white border-indigo-500 shadow-xl' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                        <Clock className={`w-3.5 h-3.5 ${highlights ? 'text-white/60' : 'text-slate-400'}`} />
                        <span className="text-[11px] font-black tabular-nums tracking-tight">
                            {slot.startTime}
                        </span>
                    </div>
                    <div className="flex gap-1.5">
                       {slot.isExtra && <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]" title="Extra Session"></span>}
                       {slot.isPaid && <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" title="Settled"></span>}
                    </div>
                  </div>

                  <div className="space-y-1 relative z-10">
                     <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{slot.grade} • {slot.subject}</p>
                     <h3 className={`text-[15px] font-black leading-tight tracking-tight ${slot.isCompleted ? 'text-slate-400' : 'text-slate-900 group-hover/slot:text-indigo-600 transition-colors'}`}>
                        {slot.name}
                     </h3>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 relative z-10">
                    <div className="flex items-center gap-2">
                       <MapPin className="w-3.5 h-3.5 text-rose-400" />
                       <span className="uppercase tracking-widest">{slot.room}</span>
                    </div>
                    {highlights && !slot.isCompleted && <span className="text-indigo-600 font-black animate-pulse uppercase tracking-[0.15em] text-[8px]">Active Interface</span>}
                  </div>

                  <div className="pt-2 relative z-10">
                      <button
                        onClick={() => toggleClassCompletion(slot, slot)}
                        disabled={(isPreemptive && !slot.isCompleted) || slot.isPaid}
                        className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2.5 ${
                          slot.isPaid
                            ? 'bg-amber-50 text-amber-600 border border-amber-100 cursor-not-allowed'
                          : slot.isCompleted 
                            ? 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 group/btn' 
                            : isPreemptive
                            ? 'bg-slate-50 text-slate-200 cursor-not-allowed border border-slate-50'
                            : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-slate-900 hover:-translate-y-1'
                        }`}
                      >
                         {slot.isPaid ? (
                            <><Lock className="w-3.5 h-3.5" /> Archive Settled</>
                         ) : slot.isCompleted ? (
                            <><RotateCcw className="w-3.5 h-3.5 group-hover/btn:rotate-[-120deg] transition-transform" /> Revert Module</>
                         ) : isPreemptive ? (
                            <><Clock className="w-3.5 h-3.5" /> Pending Start</>
                         ) : (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Verify Completion</>
                         )}
                      </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-32 text-center bg-white border-2 border-dashed border-slate-100 rounded-[3rem]">
                <Calendar className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No Operational assignments<br/>for this temporal slot.</p>
            </div>
          )}
        </div>
      </div>

      <ExtraSessionModal 
        isOpen={isExtraModalOpen}
        onClose={() => setIsExtraModalOpen(false)}
        onSuccess={() => {}}
        classes={classes}
        preselectedDate={selectedDate}
      />
    </div>
  );

}
