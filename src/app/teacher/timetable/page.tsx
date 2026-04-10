"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar, Clock, MapPin, Share2, Printer, ArrowRight, CheckCircle2, RotateCcw, History as HistoryIcon, ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { Class, ClassSchedule } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { formatTime } from "@/lib/formatters";
import { format, addMonths, subMonths, isSameDay, isAfter, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, setYear, setMonth } from "date-fns";
import toast from "react-hot-toast";

interface SessionCompletion {
  classId: string;
  date: string;
  startTime: string;
  id: string;
}

interface TimetableSlot extends Class, ClassSchedule {
  classId: string;
  uniqueSlotId: string;
  isCompleted?: boolean;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [completions, setCompletions] = useState<SessionCompletion[]>([]);
  
  // Toggle & Picker States
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const selectedDayName = format(selectedDate, "eeee").toLowerCase();
  const currentDayName = format(currentTime, "eeee").toLowerCase();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    
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

  const toggleClassCompletion = async (classItem: Class, slot: ClassSchedule) => {
    if (!user?.uid) return;
    
    const [startH, startM] = slot.startTime.split(':').map(Number);
    const slotDateTime = new Date(selectedDate);
    slotDateTime.setHours(startH, startM, 0, 0);

    const isFuture = isAfter(slotDateTime, currentTime);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const startTimeSafe = slot.startTime.replace(/:/g, '-');
    const completionId = `${classItem.id}_${dateStr}_${startTimeSafe}`;
    const isCurrentlyCompleted = completions.some(c => c.id === completionId);

    if (isFuture && !isCurrentlyCompleted) {
        toast.error("Temporal violation: Future sessions cannot be settled yet.");
        return;
    }

    try {
      const completionRef = doc(db, "session_completions", completionId);
      const classRef = doc(db, "classes", classItem.id);

      if (isCurrentlyCompleted) {
        await deleteDoc(completionRef);
        await updateDoc(classRef, {
            completedSessions: increment(-1),
            sessionsSinceLastPayment: increment(-1)
        });
        toast.success(`Session for ${classItem.name} reverted.`);
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
        toast.success(`Session for ${classItem.name} settled!`);
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
        return {
            ...slot,
            isCompleted: completions.some(c => c.id === completionId)
        };
    });

  const isSlotLive = (slotDay: string, startTime: string, endTime: string) => {
    const dayMatches = isToday(selectedDate) && slotDay.toLowerCase() === currentDayName.toLowerCase();
    if (!dayMatches) return false;

    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    return now >= (startH * 60 + startM) && now <= (endH * 60 + endM);
  };

  // Calendar logic
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePrevMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const handleNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const handleJumpToToday = () => setSelectedDate(new Date());

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Premium Compact Faculty HUD */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-100/30 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl shadow-lg flex items-center justify-center">
                    <CalendarDays className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Faculty Roadmap</h2>
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em]">{format(currentTime, "EEEE, MMMM d")}</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-lg transition-all text-indigo-400 hover:text-indigo-600"><ChevronLeft className="w-4 h-4" /></button>
                    <button 
                        onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:text-indigo-600 transition-all flex items-center gap-2"
                    >
                        {format(selectedDate, "MMMM yyyy")}
                        {isCalendarExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-lg transition-all text-indigo-400 hover:text-indigo-600"><ChevronRight className="w-4 h-4" /></button>
                </div>
                {!isToday(selectedDate) && (
                    <button onClick={handleJumpToToday} className="px-5 py-2.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-600 transition-all">Today</button>
                )}
            </div>
        </div>

        {isCalendarExpanded && (
            <div className="pt-8 border-t border-slate-50 animate-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-end gap-2 mb-6 text-[9px] font-black uppercase tracking-widest">
                    <div className="relative">
                        <button onClick={() => { setIsMonthPickerOpen(!isMonthPickerOpen); setIsYearPickerOpen(false); }} className="px-4 py-2 bg-slate-50 rounded-lg hover:text-indigo-600 transition-all">Month Matrix</button>
                        {isMonthPickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-indigo-100 shadow-2xl rounded-2xl p-3 z-50 grid grid-cols-3 gap-2 min-w-[300px] animate-in slide-in-from-top-2">
                                {months.map((m, i) => (
                                    <button 
                                        key={m} 
                                        onClick={() => { setSelectedDate(setMonth(selectedDate, i)); setIsMonthPickerOpen(false); }}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${format(selectedDate, "MMMM") === m ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                                    >
                                        {m.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button onClick={() => { setIsYearPickerOpen(!isYearPickerOpen); setIsMonthPickerOpen(false); }} className="px-4 py-2 bg-slate-50 rounded-lg hover:text-indigo-600 transition-all">Year Cycle</button>
                        {isYearPickerOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white border border-indigo-100 shadow-2xl rounded-2xl p-3 z-50 grid grid-cols-3 gap-2 min-w-[200px] animate-in slide-in-from-top-2">
                                {years.map((y) => (
                                    <button 
                                        key={y} 
                                        onClick={() => { setSelectedDate(setYear(selectedDate, y)); setIsYearPickerOpen(false); }}
                                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${format(selectedDate, "yyyy") === y.toString() ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-7 border border-slate-100 rounded-[2rem] overflow-hidden bg-slate-50/20">
                    <div className="col-span-full grid grid-cols-7 bg-white border-b border-slate-50">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                            <div key={day} className="py-4 text-center text-[9px] font-black uppercase text-slate-400">{day}</div>
                        ))}
                    </div>
                    {calendarDays.map((date) => {
                        const isSelected = isSameDay(date, selectedDate);
                        const isDayMonth = isSameMonth(date, selectedDate);
                        return (
                            <button 
                                key={date.toString()}
                                onClick={() => { setSelectedDate(date); setIsCalendarExpanded(false); }}
                                className={`p-4 flex flex-col items-center justify-center transition-all border-r border-b border-slate-50 last:border-r-0 ${!isDayMonth ? 'opacity-10 pointer-events-none' : 'hover:bg-white'} ${isSelected ? 'bg-white' : ''}`}
                            >
                                <span className={`text-[13px] font-black tabular-nums transition-all ${isSelected ? 'bg-indigo-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg' : 'text-slate-800'} ${isToday(date) && !isSelected ? 'text-indigo-600' : ''}`}>
                                    {format(date, "d")}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        )}
      </div>

      {/* Main Schedule Container */}
      <div className="space-y-8">
        <div className="flex items-center justify-between px-6 pt-4">
             <h4 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-4">
                <span className="w-1.5 h-10 bg-indigo-600 rounded-full"></span>
                {format(selectedDate, "eeee, d'th' MMMM")}
             </h4>
             <Link href="/teacher/ledger" className="hidden lg:flex px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                <HistoryIcon className="w-4 h-4 mr-2" /> Settlement History
             </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
             [1, 2].map(i => <div key={i} className="bg-white rounded-[3rem] border border-slate-50 h-40 animate-pulse" />)
          ) : filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const matchesLive = isSlotLive(slot.dayOfWeek, slot.startTime, slot.endTime);
              const [sH, sM] = slot.startTime.split(':').map(Number);
              const slotDT = new Date(selectedDate);
              slotDT.setHours(sH, sM, 0, 0);
              const isPreemptive = isAfter(slotDT, currentTime);

              return (
                <div 
                    key={slot.uniqueSlotId} 
                    className={`bg-white rounded-[3rem] border p-8 transition-all duration-700 flex flex-col gap-6 relative overflow-hidden group/slot ${
                        slot.isCompleted 
                        ? 'border-emerald-100 bg-emerald-50/20' 
                        : matchesLive 
                            ? 'border-indigo-600 shadow-2xl shadow-indigo-100 ring-4 ring-indigo-500/5' 
                            : 'border-slate-100 hover:shadow-xl'
                    }`}
                >
                  <div className="flex items-center justify-between z-10">
                    <div className={`px-5 py-3 rounded-2xl flex flex-col items-center justify-center ${matchesLive ? 'bg-indigo-600 shadow-xl' : 'bg-slate-50 border border-slate-100'}`}>
                        <span className={`text-sm font-black tabular-nums transition-colors ${matchesLive ? 'text-white' : 'text-slate-800'}`}>{formatTime(slot.startTime)}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${matchesLive ? 'text-white/60' : 'text-slate-400'}`}>{formatTime(slot.endTime)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-black text-indigo-600 uppercase tracking-widest">{slot.grade}</span>
                        <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[9px] font-black text-slate-500 uppercase tracking-widest">{slot.subject}</span>
                    </div>
                  </div>

                  <div className="space-y-4 z-10">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover/slot:text-indigo-600 transition-colors uppercase">{slot.name}</h3>
                    <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-emerald-500" /> {slot.room || "Room 101"}
                        </div>
                        <div className="flex items-center gap-2 text-indigo-400">
                            <Clock className="w-4 h-4" /> Academic Unit
                        </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50 flex items-center justify-between z-10 mt-auto">
                     <button
                        onClick={() => toggleClassCompletion(slot, slot)}
                        disabled={isPreemptive && !slot.isCompleted}
                        className={`min-w-[180px] py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                        slot.isCompleted 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                            : isPreemptive
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-slate-200'
                        }`}
                     >
                        {slot.isCompleted ? (
                             <><RotateCcw className="w-4 h-4 mr-2" /> Revert settlement</>
                        ) : isPreemptive ? (
                             <><Clock className="w-4 h-4 mr-2" /> Pending Slot</>
                        ) : (
                             <><CheckCircle2 className="w-4 h-4 mr-2" /> Settlement Sync</>
                        )}
                     </button>
                     {matchesLive && !slot.isCompleted && (
                        <span className="text-[9px] font-black uppercase text-indigo-600 animate-pulse tracking-widest">Active Conduct</span>
                     )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-32 text-center bg-slate-50/50 rounded-[4rem] border-4 border-dotted border-slate-100">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mx-auto mb-6">
                    <Calendar className="w-10 h-10 text-slate-200" />
                </div>
                <h4 className="text-xl font-black text-slate-700 uppercase tracking-widest">Atmospheric Recess</h4>
                <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em] leading-loose">
                    No active modules assigned for <span className="text-indigo-600">{format(selectedDate, "EEEE")}</span>.<br/>
                    Open the <button onClick={() => setIsCalendarExpanded(true)} className="text-indigo-600 hover:underline">Matrix Toggle</button> to find a date.
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
