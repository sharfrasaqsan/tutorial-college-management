"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MapPin, User, ArrowRight, Clock, ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useTeacherProfile } from "@/context/TeacherProfileContext";
import { Class, ClassSchedule } from "@/types/models";
import { format, addMonths, subMonths, isSameDay, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, setYear, setMonth } from "date-fns";
import { formatTime } from "@/lib/formatters";

export default function TimetablePage() {
  const { openTeacherProfile } = useTeacherProfile();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Custom picker & Toggle states
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  const selectedDayName = format(selectedDate, "eeee").toLowerCase();
  const currentDayName = format(currentTime, "eeee").toLowerCase();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const q = query(collection(db, "classes"));
        const snap = await getDocs(q);
        const fetchedClasses = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Class))
          .filter(c => c.status === "active");
        
        setClasses(fetchedClasses);
      } catch (error) {
        console.error("Error loading timetable classes:", error);
      } finally {
        setLoading(false);
      }
    }
    loadClasses();
  }, []);

  const allSlots = classes.flatMap(cls => 
    (cls.schedules || []).map((schedule: ClassSchedule) => ({
      ...cls,
      ...schedule,
      classId: cls.id,
      uniqueSlotId: `${cls.id}-${schedule.dayOfWeek}-${schedule.startTime}`
    }))
  );

  const filteredSlots = allSlots
    .filter(slot => slot.dayOfWeek.toLowerCase() === selectedDayName.toLowerCase())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

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

  const isSlotLive = (slotDay: string, startTime: string, endTime: string) => {
    if (!isToday(selectedDate)) return false;
    const dayMatches = slotDay.toLowerCase() === currentDayName.toLowerCase();
    if (!dayMatches) return false;

    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const [endH, endM] = endTime.split(':').map(Number);
    const endTotal = endH * 60 + endM;

    return now >= startTotal && now <= endTotal;
  };

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-700">
      {/* Premium Compact Navigation */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-8">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-primary rounded-2xl shadow-lg flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-white" />
               </div>
               <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Academic Timeline</h1>
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">{format(currentTime, "MMMM d, yyyy")}</p>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-primary"><ChevronLeft className="w-4 h-4" /></button>
                  <button 
                    onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-primary transition-all flex items-center gap-2"
                  >
                    {format(selectedDate, "MMMM yyyy")}
                    {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400 hover:text-primary"><ChevronRight className="w-4 h-4" /></button>
               </div>
               {!isToday(selectedDate) && (
                  <button onClick={handleJumpToToday} className="px-5 py-2.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-lg">Return Today</button>
               )}
            </div>
         </div>

         {/* Expandable Calendar Grid */}
         {isCalendarExpanded && (
            <div className="pt-8 border-t border-slate-50 animate-in slide-in-from-top-4 duration-500 overflow-hidden">
                <div className="flex items-center justify-end gap-2 mb-6">
                    <div className="relative flex items-center">
                        <button 
                            onClick={() => { setIsMonthPickerOpen(!isMonthPickerOpen); setIsYearPickerOpen(false); }}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all rounded-xl bg-slate-50"
                        >
                            Select Month
                        </button>
                        {isMonthPickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-3 z-50 grid grid-cols-3 gap-2 min-w-[300px] animate-in slide-in-from-top-2">
                                {months.map((m, i) => (
                                    <button 
                                        key={m} 
                                        onClick={() => { setSelectedDate(setMonth(selectedDate, i)); setIsMonthPickerOpen(false); }}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${format(selectedDate, "MMMM") === m ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-500'}`}
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
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all rounded-xl bg-slate-50"
                        >
                            Select Year
                        </button>
                        {isYearPickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl p-3 z-50 grid grid-cols-3 gap-2 min-w-[200px] animate-in slide-in-from-top-2">
                                {years.map((y) => (
                                    <button 
                                        key={y} 
                                        onClick={() => { setSelectedDate(setYear(selectedDate, y)); setIsYearPickerOpen(false); }}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${format(selectedDate, "yyyy") === y.toString() ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-7 border border-slate-100 rounded-[2.5rem] overflow-hidden bg-slate-50/20 shadow-inner">
                    <div className="col-span-full grid grid-cols-7 bg-white border-b border-slate-50">
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
                                className={`p-4 flex flex-col items-center justify-center transition-all border-r border-b border-slate-50 last:border-r-0 relative ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : 'hover:bg-white'} ${isSelected ? 'bg-white' : ''}`}
                            >
                                <span className={`text-[13px] font-black tabular-nums transition-all ${isSelected ? 'bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-primary/30' : 'text-slate-800'} ${isToday(date) && !isSelected ? 'text-primary' : ''}`}>
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
        <div className="flex items-center justify-between px-6 pt-4">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                <span className="w-1.5 h-10 bg-primary rounded-full"></span>
                {format(selectedDate, "EEEE, d'th' MMMM")}
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-6 py-3 rounded-2xl">
                {filteredSlots.length} Active Modules
            </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
             [1, 2].map(i => <div key={i} className="bg-white rounded-[3rem] border border-slate-50 h-32 animate-pulse" />)
          ) : filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const isLive = isSlotLive(slot.dayOfWeek, slot.startTime, slot.endTime);
              return (
                <div 
                    key={slot.uniqueSlotId} 
                    className={`bg-white rounded-[3rem] border border-slate-100 p-8 flex flex-col gap-6 group/slot transition-all duration-500 hover:shadow-2xl hover:border-primary/20 ${isLive ? 'ring-4 ring-primary/10 shadow-xl shadow-primary/5 border-primary/20' : ''}`}
                >
                  <div className="flex items-center justify-between">
                     <div className={`px-5 py-3 rounded-2xl flex flex-col items-center justify-center ${isLive ? 'bg-primary shadow-xl shadow-primary/20' : 'bg-slate-50 border border-slate-100'}`}>
                        <span className={`text-sm font-black tabular-nums tracking-tighter ${isLive ? 'text-white' : 'text-slate-800'}`}>{formatTime(slot.startTime)}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isLive ? 'text-white/60' : 'text-slate-400'}`}>{formatTime(slot.endTime)}</span>
                     </div>
                     <div className="flex flex-col items-end gap-1.5">
                        <span className="px-3 py-1 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg border border-primary/10">{slot.subject}</span>
                        <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-slate-100">{slot.grade}</span>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xl font-black text-slate-900 tracking-tight group-hover/slot:text-primary transition-colors">{slot.name}</h4>
                    <div className="flex flex-wrap items-center gap-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <button onClick={() => openTeacherProfile(slot.teacherId)} className="flex items-center gap-2 hover:text-primary transition-colors">
                            <User className="w-4 h-4" /> {slot.teacherName}
                        </button>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-400" /> {slot.room || "Room 101"}
                        </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                     {isLive && (
                        <div className="flex items-center gap-2 text-primary animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                            <span className="text-[9px] font-black uppercase tracking-widest">Active Conduct</span>
                        </div>
                     )}
                     <Link href="/admin/classes" className="ml-auto text-primary text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-2">
                        View Matrix <ArrowRight className="w-3.5 h-3.5" />
                     </Link>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[4rem] border-4 border-dotted border-slate-100">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mx-auto mb-6">
                    <Clock className="w-10 h-10 text-slate-100" />
                </div>
                <h4 className="text-2xl font-black text-slate-700 uppercase tracking-tight">Silent Cycle</h4>
                <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em] leading-loose">
                    No active modules assigned for <span className="text-primary">{format(selectedDate, "EEEE")}</span>.<br/>
                    Select a different date from the <button onClick={() => setIsCalendarExpanded(true)} className="text-primary hover:underline">Chronicle Toggle</button>.
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
