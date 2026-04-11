"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, onSnapshot, getDoc } from "firebase/firestore";
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
  Lock
} from "lucide-react";
import { Class, ClassSchedule } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { formatTime } from "@/lib/formatters";
import { format, addMonths, subMonths, isSameDay, isAfter, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth } from "date-fns";
import toast from "react-hot-toast";
import { processTeacherPayroll } from "@/lib/payroll";

interface SessionCompletion {
  classId: string;
  date: string;
  startTime: string;
  id: string;
  isPaid?: boolean;
}

interface TimetableSlot extends Class, ClassSchedule {
  classId: string;
  uniqueSlotId: string;
  isCompleted?: boolean;
  isPaid?: boolean;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
  
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
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

    return () => {
      unsubClasses();
      unsubCompletions();
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
        // FIX: Read FRESH counter from Firestore to avoid stale state causing negatives
        const freshClassSnap = await getDoc(classRef);
        const freshPending = freshClassSnap.data()?.sessionsSinceLastPayment || 0;
        
        await deleteDoc(completionRef);
        await updateDoc(classRef, {
            completedSessions: increment(-1),
            sessionsSinceLastPayment: increment(freshPending > 0 ? -1 : 0)
        });
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
                const payroll = await processTeacherPayroll(user.uid, classItem.teacherName || "Teacher", freshClasses);
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

  const allSlots: TimetableSlot[] = classes.flatMap(cls => 
    (cls.schedules || []).map((schedule: ClassSchedule) => ({
      ...cls,
      ...schedule,
      classId: cls.id,
      uniqueSlotId: `${cls.id}-${schedule.dayOfWeek}-${schedule.startTime}`
    }))
  );

  const filteredSlots: TimetableSlot[] = allSlots
    .filter(slot => slot.dayOfWeek.toLowerCase() === selectedDayName.toLowerCase())
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
    const dayMatches = isToday(selectedDate) && slotDay.toLowerCase() === currentDayName.toLowerCase();
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
    <div className="max-w-[1200px] mx-auto space-y-6 pb-20 px-4">
      {/* 🔮 Dashboard Header */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 group">
        <div className="flex items-center gap-5">
            <div style={{ backgroundColor: brandColor }} className="w-12 h-12 rounded-xl shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <CalendarDays className="w-6 h-6 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Academic Timeline</h2>
                <p style={{ color: brandColor }} className="text-[9px] font-black uppercase tracking-[0.2em] mt-1 opacity-80">Faculty Logistics Terminal</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 shadow-inner">
                <button onClick={handlePrevMonth} className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-lg transition-all text-slate-400 hover:text-[#4f39f6]"><ChevronLeft className="w-4 h-4" /></button>
                <button 
                    onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-[#4f39f6] transition-all flex items-center gap-2"
                >
                    {format(selectedDate, "MMMM yyyy")}
                    {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5 text-[#4f39f6]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#4f39f6]" />}
                </button>
                <button onClick={handleNextMonth} className="w-9 h-9 flex items-center justify-center hover:bg-white rounded-lg transition-all text-slate-400 hover:text-[#4f39f6]"><ChevronRight className="w-4 h-4" /></button>
            </div>
            {!isToday(selectedDate) && (
                <button onClick={handleJumpToToday} style={{ backgroundColor: brandColor }} className="px-5 py-2.5 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all hover:scale-105">Today</button>
            )}
        </div>
      </div>

      {isCalendarExpanded && (
        <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-2xl animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-7 border border-slate-50 rounded-2xl overflow-hidden bg-white shadow-inner">
                <div className="col-span-full grid grid-cols-7 bg-slate-50 border-b border-slate-100">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                        <div key={day} className="py-2.5 text-center text-[8px] font-black uppercase text-slate-400">{day}</div>
                    ))}
                </div>
                {calendarDays.map((date) => {
                    const isSelected = isSameDay(date, selectedDate);
                    const isDayMonth = isSameMonth(date, selectedDate);
                    return (
                        <button 
                            key={date.toString()}
                            onClick={() => { setSelectedDate(date); setIsCalendarExpanded(false); }}
                            className={`h-14 flex flex-col items-center justify-center transition-all border-r border-b border-slate-50 last:border-r-0 ${!isDayMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-slate-50/50'} ${isSelected ? 'bg-indigo-50/20' : ''}`}
                        >
                            <span 
                                style={{ backgroundColor: isSelected ? brandColor : 'transparent' }} 
                                className={`text-xs font-black tabular-nums transition-all ${isSelected ? 'text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-lg' : 'text-slate-800'} ${isToday(date) && !isSelected ? 'text-[#4f39f6]' : ''}`}
                            >
                                {format(date, "d")}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
      )}

      {/* 📊 Achievement HUD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
              <div className="relative w-12 h-12 flex-shrink-0">
                {loading ? (
                    <Skeleton variant="circle" className="w-12 h-12" />
                ) : (
                    <>
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle className="text-slate-100 stroke-current" strokeWidth="12" fill="transparent" r="40" cx="50" cy="50" />
                            <circle 
                                style={{ color: brandColor }}
                                className="stroke-current transition-all duration-1000 ease-out" 
                                strokeWidth="12" 
                                strokeDasharray={251.2} 
                                strokeDashoffset={251.2 - (251.2 * progressPercent) / 100} 
                                strokeLinecap="round" 
                                fill="transparent" 
                                r="40" cx="50" cy="50" 
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-800">{Math.round(progressPercent)}%</div>
                    </>
                )}
              </div>
              <div className="flex-1">
                  {loading ? (
                      <div className="space-y-2">
                          <Skeleton className="h-2 w-24" />
                          <Skeleton className="h-1.5 w-full" />
                      </div>
                  ) : (
                      <>
                        <div className="flex justify-between items-center mb-1.5">
                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Progress Density</p>
                            <p style={{ color: brandColor }} className="text-[9px] font-black uppercase tracking-widest">{completedCount}/{filteredSlots.length} Settled</p>
                        </div>
                        <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%`, backgroundColor: brandColor }} />
                        </div>
                      </>
                  )}
              </div>
          </div>
          <Link href="/teacher/ledger" className="bg-slate-900 px-6 rounded-[2rem] shadow-lg flex items-center justify-between hover:bg-slate-800 transition-all group">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Ledger</p>
                <p className="text-white font-black uppercase tracking-widest text-[9px]">Audit</p>
              </div>
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"><History className="w-4 h-4 text-slate-400" /></div>
          </Link>
      </div>

      {/* 📅 Compact Schedule List */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2 pt-2">
             <div style={{ backgroundColor: brandColor }} className="w-1.5 h-6 rounded-full"></div>
             <h4 className="text-lg font-black text-slate-800 tracking-tight capitalize">
                {format(selectedDate, "eeee, MMMM d")}
             </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
             [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-[1.5rem] border border-slate-100 p-5 space-y-4">
                   <div className="flex justify-between">
                      <Skeleton className="h-10 w-20 rounded-xl" />
                      <Skeleton className="h-4 w-12 ml-auto" />
                   </div>
                   <Skeleton className="h-5 w-3/4" />
                   <div className="flex gap-4">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-20 ml-auto" />
                   </div>
                   <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
             ))
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
                    className={`bg-white rounded-[1.5rem] border p-5 transition-all duration-500 flex flex-col gap-4 relative group/slot ${
                        slot.isCompleted 
                        ? 'border-emerald-100 bg-emerald-50/10' 
                        : highlights 
                            ? 'shadow-xl shadow-indigo-100 ring-4 ring-indigo-500/5' 
                            : 'border-slate-100 hover:border-slate-200 hover:shadow-lg'
                    }`}
                    style={{ borderColor: highlights && !slot.isCompleted ? brandColor : undefined }}
                >
                  <div className="flex items-center justify-between relative">
                    <div style={{ backgroundColor: highlights ? brandColor : '#0f172a' }} className="px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-xl">
                        <Clock className={`w-4 h-4 ${highlights ? 'text-white/60' : 'text-slate-400'}`} />
                        <div className="flex flex-col">
                            <span className="text-[12px] font-black tabular-nums text-white leading-tight">
                                {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                            </span>
                            <span className="text-[7px] font-black uppercase text-white/40 tracking-[0.2em]">
                                Full Session Segment
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        {highlights && !slot.isCompleted && (
                            <span style={{ backgroundColor: `${brandColor}15`, color: brandColor }} className="px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse flex items-center gap-1">
                                <Zap style={{ fill: brandColor }} className="w-2 h-2" /> Live Now
                            </span>
                        )}
                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{slot.grade}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{slot.subject}</span>
                    </div>
                  </div>

                  <div className="min-h-[20px]">
                     <h3 style={{ color: highlights ? brandColor : undefined }} className="text-base font-black text-slate-800 tracking-tight transition-colors uppercase leading-none truncate">{slot.name}</h3>
                  </div>

                  <div className="flex items-center gap-2 pb-1 justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" /> 
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{slot.room || "Room 01"}</span>
                    </div>
                    {slot.isPaid && (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1.5 border border-amber-100 transition-all scale-110 origin-right">
                             <Lock className="w-2.5 h-2.5" /> Financially Settled
                        </span>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-50">
                     <button
                        onClick={() => toggleClassCompletion(slot, slot)}
                        disabled={(isPreemptive && !slot.isCompleted) || slot.isPaid}
                        style={{ backgroundColor: slot.isPaid ? undefined : slot.isCompleted ? undefined : isPreemptive ? undefined : brandColor }}
                        className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2.5 ${
                        slot.isPaid
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed grayscale'
                        : slot.isCompleted 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-50 hover:bg-emerald-600' 
                            : isPreemptive
                            ? 'bg-slate-50 text-slate-200 cursor-not-allowed border border-slate-50'
                            : 'text-white hover:opacity-90 shadow-xl shadow-indigo-100'
                        }`}
                     >
                        {slot.isPaid ? (
                             <><Lock className="w-4 h-4" /> Locked</>
                        ) : slot.isCompleted ? (
                             <><RotateCcw className="w-4 h-4" /> Revert Verification</>
                        ) : isPreemptive ? (
                             <><Clock className="w-4 h-4" /> Pending</>
                        ) : (
                             <><CheckCircle2 className="w-4 h-4" /> Mark Completion</>
                        )}
                     </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-slate-100 border-dashed">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-200" />
                </div>
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Atmospheric Recess</h4>
                <p style={{ color: brandColor }} className="text-[9px] font-black mt-2 uppercase tracking-widest underline cursor-pointer" onClick={() => setIsCalendarExpanded(true)}>Change Temporal Coordinates</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
