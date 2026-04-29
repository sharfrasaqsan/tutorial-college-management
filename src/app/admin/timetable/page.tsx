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

  const handlePrevDay = () => setSelectedDate(prev => new Date(new Date(prev).setDate(prev.getDate() - 1)));
  const handleNextDay = () => setSelectedDate(prev => new Date(new Date(prev).setDate(prev.getDate() + 1)));
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
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="relative z-[60]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Timetable</h1>
            <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
              {format(currentTime, "EEEE, dd MMMM")} • {format(currentTime, "hh:mm a")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={handlePrevDay} className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-primary"><ChevronLeft className="w-4 h-4" /></button>
              <button 
                onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-primary transition-all flex items-center gap-2"
              >
                {format(selectedDate, "dd MMM yyyy")}
                {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />}
              </button>
              <button onClick={handleNextDay} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-primary"><ChevronRight className="w-4 h-4" /></button>
            </div>
            {!isToday(selectedDate) && (
              <button 
                onClick={handleJumpToToday} 
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* 📅 High-Fidelity Mini Calendar Selector (Overlay) */}
        {isCalendarExpanded && (
          <div className="absolute right-0 top-full mt-2 bg-white/90 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 shadow-[0_32px_128px_-10px_rgba(16,185,129,0.2)] animate-in slide-in-from-top-4 duration-500 max-w-sm w-[calc(100vw-32px)] sm:w-80 overflow-hidden border-t-4 border-t-primary z-[100]">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Jump to Date</h4>
            <div className="flex items-center gap-1.5 font-bold">
              <div className="relative">
                <button 
                  onClick={() => { setIsMonthPickerOpen(!isMonthPickerOpen); setIsYearPickerOpen(false); }}
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-primary transition-all rounded-lg bg-slate-50 border border-slate-100"
                >
                  {format(selectedDate, "MMM")}
                </button>
                {isMonthPickerOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-2 z-50 grid grid-cols-3 gap-1 min-w-[200px] animate-in fade-in scale-in-95">
                    {months.map((m, i) => (
                      <button 
                        key={m} 
                        onClick={() => { setSelectedDate(setMonth(selectedDate, i)); setIsMonthPickerOpen(false); }}
                        className={`px-2 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${format(selectedDate, "MMMM") === m ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-500'}`}
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
                  className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-primary transition-all rounded-lg bg-slate-50 border border-slate-100"
                >
                  {format(selectedDate, "yyyy")}
                </button>
                {isYearPickerOpen && (
                  <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-2 z-50 grid grid-cols-3 gap-1 min-w-[180px] animate-in fade-in scale-in-95">
                    {years.map((y) => (
                      <button 
                        key={y} 
                        onClick={() => { setSelectedDate(setYear(selectedDate, y)); setIsYearPickerOpen(false); }}
                        className={`px-2 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${format(selectedDate, "yyyy") === y.toString() ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-500'}`}
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
                  className={`group relative h-10 w-full flex items-center justify-center transition-all rounded-xl ${!isCurrentMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-slate-50'} ${isSelected ? 'bg-primary/5' : ''} ${today ? 'ring-2 ring-primary/20 bg-primary/5 shadow-inner' : ''}`}
                >
                  {today && (
                    <div className="absolute inset-0 rounded-xl border-2 border-primary/40 animate-pulse pointer-events-none"></div>
                  )}
                  {today && !isSelected && (
                    <div className="absolute top-1 right-1 w-1 h-1 bg-primary rounded-full"></div>
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums transition-all ${isSelected ? 'bg-slate-900 text-white shadow-lg' : today ? 'text-primary' : 'text-slate-700'}`}>
                    {format(date, "d")}
                  </div>
                  {isSelected && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setIsCalendarExpanded(false)}
            className="w-full mt-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-rose-500 transition-colors border-t border-slate-50 pt-4"
          >
            Close Time Horizon
          </button>
        </div>
      )}
      </div>

      {/* Selected Day Context Feed */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 gap-4">
            <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-primary rounded-full"></div>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                    {format(selectedDate, "EEEE, do MMMM")}
                </h3>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    {allSlots.length} Active Modules
                </span>
            </div>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
             [1, 2, 3, 4, 5].map(i => <div key={i} className="bg-white rounded-2xl border border-slate-100 h-20 animate-pulse" />)
          ) : allSlots.length > 0 ? (
            allSlots.map((slot) => {
              const active = isSlotLive(slot.startTime, slot.endTime);
              return (
                <div 
                    key={slot.id} 
                    className={`bg-white rounded-2xl border transition-all duration-300 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 group/row ${slot.isCompleted ? 'bg-slate-50/50 border-slate-100 opacity-60' : active ? 'border-primary ring-1 ring-primary/10 shadow-lg shadow-primary/5' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}
                >
                  <div className="flex flex-1 items-center gap-6 w-full">
                    {/* Time Module */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[11px] ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>
                           {formatTime(slot.startTime).split(' ')[0]}
                        </div>
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatTime(slot.startTime).split(' ')[1]}</span>
                           <span className="text-[10px] font-bold text-slate-800 tracking-tight">{formatTime(slot.startTime)} — {formatTime(slot.endTime)}</span>
                        </div>
                    </div>

                    {/* Class Info Module */}
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center gap-2">
                           <h4 className="text-base font-bold text-slate-900 tracking-tight group-hover/row:text-primary transition-colors">{slot.className}</h4>
                           {slot.isExtra && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 text-[7px] font-black uppercase rounded border border-indigo-100 tracking-tighter">Extra</span>}
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                              <User className="w-3 h-3" /> {slot.teacherName}
                           </div>
                           <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                              <MapPin className="w-3 h-3" /> {slot.room}
                           </div>
                           <div className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-md border border-slate-100">{slot.subject}</div>
                        </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    {slot.isCompleted ? (
                        <div className="flex items-center gap-1.5 text-emerald-600">
                           <CheckCircle2 className="w-4 h-4" />
                           <span className="text-[9px] font-black uppercase tracking-widest">Completed</span>
                        </div>
                    ) : active ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500 text-white rounded-full text-[8px] font-black uppercase tracking-[0.1em] animate-pulse">
                           <span className="w-1 h-1 rounded-full bg-white"></span> LIVE NOW
                        </div>
                    ) : (
                        <div className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest">Scheduled</div>
                    )}

                    <div className="flex items-center gap-2">
                       <Link href="/admin/classes" className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-primary hover:text-white rounded-lg transition-all border border-slate-100 group/link" title="Class Matrix">
                          <ArrowRight className="w-3.5 h-3.5 group/link:translate-x-0.5 transition-transform" />
                       </Link>
                    </div>
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
