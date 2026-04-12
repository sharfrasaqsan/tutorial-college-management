"use client";
import { useState, useEffect, useMemo } from "react";

import { onSnapshot, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MapPin, User, ArrowRight, Clock, ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useTeacherProfile } from "@/context/TeacherProfileContext";
import { Class, ClassSchedule } from "@/types/models";
import { format, addMonths, subMonths, isSameDay, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, setYear, setMonth } from "date-fns";
import { formatTime } from "@/lib/formatters";

export default function TimetablePage() {
  const { openTeacherProfile } = useTeacherProfile();
  const [classes, setClasses] = useState<Class[]>([]);
  const [extraSessions, setExtraSessions] = useState<any[]>([]);
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const selectedDayName = format(selectedDate, "eeee").toLowerCase();
  const currentDayName = format(currentTime, "eeee").toLowerCase();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    // 1. Listen for Classes
    const qClasses = query(collection(db, "classes"), where("status", "==", "active"));
    const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
        setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    // 2. Listen for Extra Sessions for selected date
    const qExtras = query(collection(db, "extra_sessions"), where("date", "==", dateStr));
    const unsubscribeExtras = onSnapshot(qExtras, (snapshot) => {
        setExtraSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    });

    // 3. Listen for Completions for selected date
    const qCompletions = query(collection(db, "session_completions"), where("date", "==", dateStr));
    const unsubscribeCompletions = onSnapshot(qCompletions, (snapshot) => {
        const ids = new Set(snapshot.docs.map(doc => {
            const data = doc.data();
            const startTimeSafe = data.startTime.replace(/:/g, '-');
            return `${data.classId}_${startTimeSafe}`;
        }));
        setCompletedSessionIds(ids);
    });

    return () => {
        unsubscribeClasses();
        unsubscribeExtras();
        unsubscribeCompletions();
    };
  }, [selectedDate]);

  const allSlots = useMemo(() => {
      const regular = classes.flatMap(cls => 
        (cls.schedules || [])
          .filter(s => s.dayOfWeek.toLowerCase() === selectedDayName)
          .map((schedule: ClassSchedule) => {
            const startTimeSafe = schedule.startTime.replace(/:/g, '-');
            const key = `${cls.id}_${startTimeSafe}`;
            return {
              id: `${cls.id}|${schedule.startTime}`,
              className: cls.name,
              teacherName: cls.teacherName,
              teacherId: cls.teacherId,
              startTime: schedule.startTime,
              endTime: schedule.endTime || "",
              room: schedule.room || "Main Hall",
              grade: cls.grade,
              subject: cls.subject,
              isCompleted: completedSessionIds.has(key),
              isExtra: false
            };
          })
      );

      const extra = extraSessions.map(session => {
        const startTimeSafe = session.startTime.replace(/:/g, '-');
        const key = `${session.classId || session.id}_${startTimeSafe}`;
        return {
          id: `${session.id}|${session.startTime}`,
          className: session.className,
          teacherName: session.teacherName,
          teacherId: session.teacherId,
          startTime: session.startTime,
          endTime: session.endTime || "",
          room: session.room || "Room 101",
          grade: session.grade,
          subject: session.subject,
          isCompleted: completedSessionIds.has(key),
          isExtra: true
        };
      });

      return [...regular, ...extra].sort((a, b) => {
          const [ah, am] = a.startTime.split(':').map(Number);
          const [bh, bm] = b.startTime.split(':').map(Number);
          return (ah * 60 + am) - (bh * 60 + bm);
      });
  }, [classes, extraSessions, completedSessionIds, selectedDayName]);

  // Calendar Logic (Full Month Grid)
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const handleJumpToToday = () => setSelectedDate(new Date());

  const isSlotLive = (startTime: string) => {
    if (!isToday(selectedDate)) return false;
    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    return now >= startTotal && now <= startTotal + 120; // 2 hour window
  };

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-700">
      {/* Premium Compact Navigation */}
      <div className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-8">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-slate-900 rounded-3xl shadow-2xl shadow-slate-900/40 flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-white" />
               </div>
               <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Timeline</h1>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.4em]">{format(currentTime, "MMMM d, yyyy")}</p>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-primary"><ChevronLeft className="w-4 h-4" /></button>
                  <button 
                    onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-primary transition-all flex items-center gap-2"
                  >
                    {format(selectedDate, "MMMM yyyy")}
                    {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />}
                  </button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-primary"><ChevronRight className="w-4 h-4" /></button>
               </div>
               {!isToday(selectedDate) && (
                  <button onClick={handleJumpToToday} className="px-6 py-3 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary transition-all shadow-[0_15px_30px_rgba(15,23,42,0.2)] hover:shadow-primary/30">Sync Today</button>
               )}
            </div>
         </div>

         {/* Expandable Calendar Grid */}
         {isCalendarExpanded && (
            <div className="pt-8 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500 overflow-hidden">
                <div className="flex items-center justify-end gap-2 mb-6">
                    <div className="relative flex items-center">
                        <button 
                            onClick={() => { setIsMonthPickerOpen(!isMonthPickerOpen); setIsYearPickerOpen(false); }}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm"
                        >
                            Select Month
                        </button>
                        {isMonthPickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-3xl p-4 z-50 grid grid-cols-3 gap-2 min-w-[320px] animate-in slide-in-from-top-2">
                                {months.map((m, i) => (
                                    <button 
                                        key={m} 
                                        onClick={() => { setSelectedDate(setMonth(selectedDate, i)); setIsMonthPickerOpen(false); }}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${format(selectedDate, "MMMM") === m ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'hover:bg-slate-50 text-slate-500'}`}
                                    >
                                        {m.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative flex items-center">
                        <button 
                            onClick={() => { setIsYearPickerOpen(!isYearPickerOpen); setIsMonthPickerOpen(false); }}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all rounded-xl bg-slate-50 hover:bg-white hover:shadow-sm"
                        >
                            Select Year
                        </button>
                        {isYearPickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-3xl p-4 z-50 grid grid-cols-3 gap-2 min-w-[220px] animate-in slide-in-from-top-2">
                                {years.map((y) => (
                                    <button 
                                        key={y} 
                                        onClick={() => { setSelectedDate(setYear(selectedDate, y)); setIsYearPickerOpen(false); }}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${format(selectedDate, "yyyy") === y.toString() ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'hover:bg-slate-50 text-slate-500'}`}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1 bg-slate-50/10 p-1 rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-inner">
                    <div className="col-span-full grid grid-cols-7 mb-1">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                            <div key={day} className="py-4 text-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                                {day}
                            </div>
                        ))}
                    </div>
                    {calendarDays.map((date) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const isCurrentMonth = isSameMonth(date, selectedDate);
                        return (
                            <button 
                                key={date.toString()}
                                onClick={() => { setSelectedDate(date); setIsCalendarExpanded(false); }}
                                className={`h-20 flex flex-col items-center justify-center transition-all rounded-2xl relative ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : 'hover:bg-white hover:shadow-sm'} ${isSelected ? 'bg-white shadow-md' : ''}`}
                            >
                                <span className={`text-[13px] font-black tabular-nums transition-all ${isSelected ? 'bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(0,102,255,0.3)]' : 'text-slate-800'} ${isToday(date) && !isSelected ? 'text-primary' : ''}`}>
                                    {format(date, "d")}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
         )}
      </div>

      {/* Selected Day Context Feed */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-2 gap-4">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                <span className="w-1.5 h-10 bg-primary rounded-full shadow-[0_0_15px_rgba(0,102,255,0.4)]"></span>
                {format(selectedDate, "EEEE, d'th' MMMM")}
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-6 py-3 rounded-2xl shadow-sm">
                {allSlots.length} Operational Modules
            </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
             [1, 2, 3, 4].map(i => <div key={i} className="bg-white rounded-[3rem] border border-slate-100 h-48 animate-pulse" />)
          ) : allSlots.length > 0 ? (
            allSlots.map((slot) => {
              const active = isSlotLive(slot.startTime);
              return (
                <div 
                    key={slot.id} 
                    className={`bg-white rounded-[2.5rem] border transition-all duration-500 p-8 flex flex-col gap-6 relative group/card ${slot.isCompleted ? 'bg-slate-50/50 border-slate-100 opacity-60 grayscale-[0.5]' : active ? 'border-primary shadow-2xl shadow-primary/10 ring-1 ring-primary/20 scale-[1.02]' : 'border-slate-100 hover:border-slate-200 hover:shadow-xl'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl flex flex-col items-center justify-center min-w-[70px] ${active ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 text-slate-600'}`}>
                           <span className="text-[10px] font-black leading-none">{formatTime(slot.startTime)}</span>
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Duration</span>
                           <span className="text-[11px] font-bold text-slate-800 tracking-tighter tabular-nums">{formatTime(slot.startTime)} — {formatTime(slot.endTime)}</span>
                        </div>
                     </div>
                     
                     {slot.isCompleted ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 animate-in zoom-in duration-300">
                           <CheckCircle2 className="w-3 h-3" />
                           <span>Session Completed</span>
                        </div>
                     ) : active && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest animate-pulse shadow-lg shadow-rose-500/20">
                           <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                           LIVE MODULE
                        </div>
                     )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                       <h4 className="text-xl font-black text-slate-900 tracking-tight group-hover/card:text-primary transition-colors line-clamp-1">{slot.className}</h4>
                       {slot.isExtra && (
                          <span className="px-2 py-0.5 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest rounded-md">Ad-hoc</span>
                       )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                        <button onClick={() => openTeacherProfile(slot.teacherId)} className="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-primary transition-colors">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><User className="w-3 h-3" /></span>
                            {slot.teacherName}
                        </button>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><MapPin className="w-3 h-3" /></span>
                            {slot.room}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-black text-primary uppercase tracking-widest">
                            <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center"><ArrowRight className="w-3 h-3" /></span>
                            {slot.grade}
                        </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                     <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-slate-200">{slot.subject}</span>
                     <Link href="/admin/classes" className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-2 group/link">
                        Matrix Data <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                     </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[4rem] border-4 border-dotted border-slate-100 shadow-inner">
                <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-slate-200 mx-auto mb-8 border border-slate-50">
                    <Clock className="w-10 h-10 text-slate-200 animate-spin-slow" />
                </div>
                <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Silent Orbit</h4>
                <p className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.3em] leading-loose max-w-md mx-auto">
                    No operational modules detected for the selected chronicle day.<br/>
                    Adjust your horizon using the <button onClick={() => setIsCalendarExpanded(true)} className="text-primary hover:underline font-bold">Temporal Grid</button>.
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
