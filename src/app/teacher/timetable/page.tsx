"use client";

import { useState, useEffect, useMemo } from "react";
import { onSnapshot, collection, query, where, doc, setDoc, deleteDoc, getDoc, updateDoc, writeBatch, deleteField, getDocs, increment, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  MapPin, 
  User, 
  ArrowRight, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  RotateCcw, 
  Lock,
  Zap,
  Activity
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Class, ClassSchedule } from "@/types/models";
import { format, addMonths, subMonths, isSameDay, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, setYear, setMonth, isAfter } from "date-fns";
import { formatTime } from "@/lib/formatters";
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
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);

  const selectedDayName = format(selectedDate, "eeee").toLowerCase();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid), where("status", "==", "active"));
    const unsubClasses = onSnapshot(qClasses, (snap) => {
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    const qExtras = query(collection(db, "extra_sessions"), where("teacherId", "==", user.uid), where("date", "==", dateStr));
    const unsubExtras = onSnapshot(qExtras, (snap) => {
        setExtraSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtraSession)));
        setLoading(false);
    });

    const qCompletions = query(collection(db, "session_completions"), where("teacherId", "==", user.uid), where("date", "==", dateStr));
    const unsubCompletions = onSnapshot(qCompletions, (snap) => {
        setCompletions(snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as SessionCompletion)));
    });

    return () => {
        unsubClasses();
        unsubExtras();
        unsubCompletions();
    };
  }, [user, selectedDate]);

  const allSlots = useMemo(() => {
    const regular = classes.flatMap(cls => 
      (cls.schedules || [])
        .filter(s => s.dayOfWeek.toLowerCase() === selectedDayName)
        .map((schedule: ClassSchedule) => {
          const startTimeSafe = schedule.startTime.replace(/:/g, '-');
          const dateStr = format(selectedDate, "yyyy-MM-dd");
          const completionId = `${cls.id}_${dateStr}_${startTimeSafe}`;
          const completion = completions.find(c => c.id === completionId);

          return {
            id: `${cls.id}|${schedule.startTime}`,
            uniqueSlotId: completionId,
            classId: cls.id,
            className: cls.name,
            startTime: schedule.startTime,
            endTime: schedule.endTime || "",
            room: schedule.room || "Main Hall",
            grade: cls.grade,
            subject: cls.subject,
            isCompleted: !!completion,
            isPaid: !!completion?.isPaid,
            isExtra: false,
            rawClass: cls
          };
        })
    );

    const extra = extraSessions.map(session => {
      const startTimeSafe = session.startTime.replace(/:/g, '-');
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const completionId = `${session.classId || session.id}_${dateStr}_${startTimeSafe}`;
      const completion = completions.find(c => c.id === completionId);

      return {
        id: `${session.id}|${session.startTime}`,
        uniqueSlotId: completionId,
        classId: session.classId,
        className: session.className,
        startTime: session.startTime,
        endTime: session.endTime || "",
        room: session.room || "Room 101",
        grade: session.grade,
        subject: session.subject,
        isCompleted: !!completion,
        isPaid: !!completion?.isPaid,
        isExtra: true
      };
    });

    return [...regular, ...extra].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [classes, extraSessions, completions, selectedDayName, selectedDate]);

  const toggleClassCompletion = async (slot: any) => {
    if (!user?.uid) return;
    
    if (slot.isPaid) {
        toast.error("Audit Lock: Session has been settled.");
        return;
    }

    const [startH, startM] = slot.startTime.split(':').map(Number);
    const slotDateTime = new Date(selectedDate);
    slotDateTime.setHours(startH, startM, 0, 0);

    const isFuture = isAfter(slotDateTime, currentTime);
    const completionId = slot.uniqueSlotId;
    const isCurrentlyCompleted = slot.isCompleted;

    if (isFuture && !isCurrentlyCompleted) {
        toast.error("Process Blocked: Future session.");
        return;
    }

    try {
      const completionRef = doc(db, "session_completions", completionId);
      const classRef = doc(db, "classes", slot.classId);

      if (isCurrentlyCompleted) {
        const [freshClassSnap, completionSnap] = await Promise.all([
            getDoc(classRef),
            getDoc(completionRef)
        ]);
        
        const completionData = completionSnap.data();
        const freshPending = freshClassSnap.data()?.sessionsSinceLastPayment || 0;
        const batch = writeBatch(db);

        let pendingDelta = freshPending > 0 ? -1 : 0;

        if (completionData?.salaryId) {
            const salaryRef = doc(db, "salaries", completionData.salaryId);
            const salarySnap = await getDoc(salaryRef);
            
            if (salarySnap.exists() && salarySnap.data().status === "pending") {
                const sessionsCovered = salarySnap.data().sessionsConducted || 0;
                pendingDelta = sessionsCovered - 1;
                batch.delete(salaryRef);

                const otherCompletionsQ = query(collection(db, "session_completions"), where("salaryId", "==", completionData.salaryId));
                const otherCompletionsSnap = await getDocs(otherCompletionsQ);
                otherCompletionsSnap.docs.forEach(d => {
                    batch.update(doc(db, "session_completions", d.id), { salaryId: deleteField() });
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
            classId: slot.classId,
            className: slot.className,
            teacherId: user.uid,
            teacherName: user.displayName || "Teacher",
            date: format(selectedDate, "yyyy-MM-dd"),
            dayOfWeek: selectedDayName,
            timestamp: serverTimestamp(),
            startTime: slot.startTime,
            endTime: slot.endTime,
            subject: slot.subject,
            grade: slot.grade,
            studentCount: slot.rawClass?.studentCount || 0,
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

        // Auto-payroll check
        try {
            const classQ = query(collection(db, "classes"), where("teacherId", "==", user.uid));
            const freshClassesSnap = await getDocs(classQ);
            const freshClasses = freshClassesSnap.docs.map(d => ({ ...d.data(), id: d.id } as Class));
            const targetClass = freshClasses.find(c => c.id === slot.classId);
            if (targetClass && (targetClass.sessionsSinceLastPayment || 0) >= (targetClass.sessionsPerCycle || 8)) {
                const payroll = await processTeacherPayroll(user.uid, user.displayName || "Teacher", freshClasses, undefined, completionId);
                if (payroll.success) toast.success("Milestone reached! Salary request generated.", { icon: "💰" });
            }
        } catch (e) {}
      }
    } catch (error) {
       console.error("Sync Error:", error);
       toast.error("Process failed.");
    }
  };

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const handleJumpToToday = () => setSelectedDate(new Date());

  const isSlotLive = (startTime: string, endTime?: string) => {
    if (!isToday(selectedDate)) return false;
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    
    let endTotal;
    if (endTime && endTime.includes(':')) {
        const [endH, endM] = endTime.split(':').map(Number);
        endTotal = endH * 60 + endM + 15; // 15 min buffer after end
    } else {
        endTotal = startTotal + 120; // 2 hour window fallback
    }

    return now >= startTotal && now <= endTotal;
  };

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const completedCount = allSlots.filter(s => s.isCompleted).length;
  const progressPercent = allSlots.length > 0 ? (completedCount / allSlots.length) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-[1400px] mx-auto">
      {/* 🏛️ Dashboard-standard Header */}
      <div className="relative z-[60]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Timetable</h1>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              {format(currentTime, "EEEE, dd MMMM")} • {format(currentTime, "hh:mm a")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-indigo-200">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-indigo-600"><ChevronLeft className="w-4 h-4" /></button>
              <button 
                onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-indigo-600 transition-all flex items-center gap-2"
              >
                {format(selectedDate, "MMMM yyyy")}
                {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-indigo-600"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              {!isToday(selectedDate) && (
                <button 
                  onClick={handleJumpToToday} 
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
                >
                  Sync Today
                </button>
              )}
              <button 
                  onClick={() => setIsExtraModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
              >
                  <Zap className="w-3.5 h-3.5" /> Extra Class
              </button>
            </div>
          </div>
        </div>

        {/* 📅 High-Fidelity Mini Calendar Selector (Overlay) */}
        {isCalendarExpanded && (
          <div className="absolute right-0 top-full mt-2 bg-white/90 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 shadow-[0_32px_128px_-10px_rgba(79,70,229,0.3)] animate-in slide-in-from-top-4 duration-500 max-w-sm w-[calc(100vw-32px)] sm:w-80 overflow-hidden border-t-4 border-t-indigo-600 z-[100]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Select Date</h4>
            <div className="flex items-center gap-1.5 font-bold">
              <div className="relative">
                <button 
                  onClick={() => { setIsMonthPickerOpen(!isMonthPickerOpen); setIsYearPickerOpen(false); }}
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-indigo-600 transition-all rounded-lg bg-slate-50 border border-slate-100"
                >
                  {format(selectedDate, "MMM")}
                </button>
                {isMonthPickerOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-2 z-50 grid grid-cols-3 gap-1 min-w-[200px] animate-in fade-in scale-in-95">
                    {months.map((m, i) => (
                      <button 
                        key={m} 
                        onClick={() => { setSelectedDate(setMonth(selectedDate, i)); setIsMonthPickerOpen(false); }}
                        className={`px-2 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${format(selectedDate, "MMMM") === m ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-slate-500'}`}
                      >
                        {m.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button 
                  onClick={() => { setIsYearPickerOpen(!isYearPickerOpen); setIsMonthPickerOpen(false); }}
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-indigo-600 transition-all rounded-lg bg-slate-50 border border-slate-100"
                >
                  {format(selectedDate, "yyyy")}
                </button>
                {isYearPickerOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-2 z-50 grid grid-cols-3 gap-1 min-w-[180px] animate-in fade-in scale-in-95">
                    {years.map((y) => (
                      <button 
                        key={y} 
                        onClick={() => { setSelectedDate(setYear(selectedDate, y)); setIsYearPickerOpen(false); }}
                        className={`px-2 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${format(selectedDate, "yyyy") === y.toString() ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-slate-500'}`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(day => (
              <div key={day} className="h-8 flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-300">
                {day}
              </div>
            ))}
            {calendarDays.map((date) => {
              const isSelected = isSameDay(date, selectedDate);
              const isCurrentMonth = isSameMonth(date, selectedDate);
              const today = isToday(date);
              
              return (
                <button 
                  key={date.toString()}
                  onClick={() => { setSelectedDate(date); setIsCalendarExpanded(false); }}
                  className={`group relative h-10 w-full flex items-center justify-center transition-all rounded-xl ${!isCurrentMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-slate-50'} ${isSelected ? 'bg-indigo-50' : ''} ${today ? 'ring-2 ring-indigo-500/20 bg-indigo-50/10' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums transition-all ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : today ? 'text-indigo-600 font-black' : 'text-slate-700'}`}>
                    {format(date, "d")}
                  </div>
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setIsCalendarExpanded(false)}
            className="w-full mt-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-rose-500 transition-colors border-t border-slate-50 pt-4"
          >
            Close Calendar
          </button>
        </div>
      )}
      </div>

      {/* 🚀 High-Density Accomplishment HUD */}
      <div className="bg-white/60 border border-slate-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center gap-8 group hover:bg-white hover:shadow-2xl hover:shadow-indigo-100/40 transition-all duration-700">
          <div className="relative w-16 h-16 flex items-center justify-center bg-indigo-50 rounded-[1.5rem] shrink-0">
            <Activity className="w-7 h-7 text-indigo-600" />
            <svg className="absolute -inset-2 w-20 h-20" viewBox="0 0 100 100">
                <circle className="text-slate-100 stroke-current" strokeWidth="6" fill="transparent" r="42" cx="50" cy="50" />
                <circle 
                    className="text-indigo-600 stroke-current transition-all duration-1000 ease-out" 
                    strokeWidth="6" 
                    strokeDasharray={263.8} 
                    strokeDashoffset={263.8 - (263.8 * progressPercent) / 100} 
                    strokeLinecap="round" 
                    fill="transparent" 
                    r="42" cx="50" cy="50" 
                />
            </svg>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">Class Progress</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">{completedCount} of {allSlots.length} Classes Completed</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-600 italic">{Math.round(progressPercent)}%</span>
                </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-indigo-600 transition-all duration-1000 shadow-[0_0_15px_rgba(79,70,229,0.4)]" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
      </div>

      {/* Selected Day Context Feed */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 gap-4">
            <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
                <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                        {format(selectedDate, "EEEE, do MMMM")}
                    </h3>
                    <p className="text-[10px] font-black text-indigo-500/60 uppercase tracking-widest mt-0.5">Class Schedule</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                    {allSlots.length} Total Sessions
                </span>
            </div>
        </div>

        <div className="flex flex-col gap-4">
          {loading ? (
             [1, 2, 3].map(i => <div key={i} className="bg-white rounded-3xl border border-slate-100 h-24 animate-pulse" />)
          ) : allSlots.length > 0 ? (
            allSlots.map((slot) => {
              const active = isSlotLive(slot.startTime, slot.endTime);
              const [sH, sM] = (slot.startTime || "00:00").split(':').map(Number);
              const slotDT = new Date(selectedDate);
              slotDT.setHours(sH, sM, 0, 0);
              const isFuture = isAfter(slotDT, currentTime);

              return (
                <div 
                    key={slot.id} 
                    className={`bg-white rounded-3xl border transition-all duration-500 px-8 py-5 flex flex-col lg:flex-row items-center justify-between gap-6 group/row ${slot.isCompleted ? 'bg-slate-50/40 border-slate-100 opacity-60' : active ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-xl shadow-indigo-100/40' : 'border-slate-100 hover:border-indigo-200 hover:shadow-xl'}`}
                >
                  <div className="flex flex-1 items-center gap-8 w-full">
                    {/* Time Module */}
                    <div className="flex items-center gap-4 min-w-[160px]">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 rotate-3' : 'bg-slate-50 text-slate-500 group-hover/row:bg-indigo-50 group-hover/row:text-indigo-600'}`}>
                           {formatTime(slot.startTime).split(' ')[0]}
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1.5">{formatTime(slot.startTime).split(' ')[1]}</span>
                           <span className="text-sm font-black text-slate-800 tracking-tight tabular-nums">{formatTime(slot.startTime)} — {formatTime(slot.endTime)}</span>
                        </div>
                    </div>

                    {/* Class Info Module */}
                    <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center gap-3">
                           <h4 className={`text-lg font-black tracking-tight transition-colors ${slot.isCompleted ? 'text-slate-400' : 'text-slate-900 group-hover/row:text-indigo-600'}`}>{slot.className}</h4>
                           {slot.isExtra && <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg shadow-indigo-200 tracking-widest">Extra</span>}
                        </div>
                        <div className="flex flex-wrap items-center gap-5">
                           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               <MapPin className="w-3.5 h-3.5 text-rose-400" /> {slot.room}
                           </div>
                           <div className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-xl border border-slate-100 group-hover/row:border-indigo-100 group-hover/row:text-indigo-600 transition-all">{slot.subject}</div>
                           <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-xl border border-indigo-100">{slot.grade}</div>
                        </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-8 w-full lg:w-auto justify-between lg:justify-end">
                    {slot.isPaid ? (
                        <div className="flex items-center gap-2 text-amber-500 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                           <Lock className="w-4 h-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Settled</span>
                        </div>
                    ) : slot.isCompleted ? (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                           <CheckCircle2 className="w-4 h-4" />
                           <span className="text-[10px] font-black uppercase tracking-widest">Completed</span>
                        </div>
                    ) : active ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-full text-[9px] font-black uppercase tracking-[0.1em] shadow-lg shadow-rose-200 animate-pulse">
                           <div className="w-1.5 h-1.5 rounded-full bg-white"></div> LIVE NOW
                        </div>
                    ) : isFuture ? (
                        <div className="px-4 py-2 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-100">Scheduled</div>
                    ) : (
                        <div className="px-4 py-2 bg-indigo-50 text-indigo-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm">Mark Completed</div>
                    )}

                    <button 
                        onClick={() => toggleClassCompletion(slot)}
                        disabled={slot.isPaid || (isFuture && !slot.isCompleted)}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl group/btn ${
                            slot.isPaid 
                            ? 'bg-amber-50 text-amber-300 opacity-30 cursor-not-allowed' 
                            : slot.isCompleted 
                            ? 'bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200' 
                            : isFuture 
                            ? 'bg-slate-50 text-slate-200 border-none cursor-not-allowed' 
                            : 'bg-slate-900 text-white hover:bg-indigo-600 hover:shadow-indigo-200 active:scale-95'
                        }`}
                    >
                        {slot.isCompleted ? <RotateCcw className="w-6 h-6 group-hover/btn:rotate-[-120deg] transition-transform" /> : <CheckCircle2 className="w-7 h-7" />}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-40 text-center bg-slate-50/50 rounded-[4rem] border-4 border-dotted border-slate-100 mt-10">
                <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-slate-200 mx-auto mb-10 border border-slate-50">
                    <Clock className="w-12 h-12 text-slate-200" />
                </div>
                <h4 className="text-2xl font-black text-slate-800 uppercase tracking-tight">No classes scheduled</h4>
                <p className="text-[10px] font-black text-slate-400 mt-6 uppercase tracking-[0.3em] leading-loose max-w-sm mx-auto opacity-70">
                    No classroom activity detected for the selected date.
                </p>
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
