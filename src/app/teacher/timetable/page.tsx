"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar, Clock, MapPin, Share2, Printer, ArrowRight } from "lucide-react";
import { Class, ClassSchedule } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Day selection states
  const jsDayIndex = currentTime.getDay();
  const dayIndexMap = [6, 0, 1, 2, 3, 4, 5]; // sunday=6, monday=0, etc.
  const currentDayName = days[dayIndexMap[jsDayIndex]];
  const [selectedDay, setSelectedDay] = useState(currentDayName);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadSchedule() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const q = query(collection(db, "classes"), where("teacherId", "==", user.uid));
        const snap = await getDocs(q);
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        console.error("Error loading schedule", error);
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, [user]);

  const allSlots = classes.flatMap(cls => 
    (cls.schedules || []).map((schedule: ClassSchedule) => ({
      ...cls,
      ...schedule,
      classId: cls.id,
      uniqueSlotId: `${cls.id}-${schedule.dayOfWeek}-${schedule.startTime}`
    }))
  );

  const filteredSlots = allSlots
    .filter(slot => slot.dayOfWeek.toLowerCase() === selectedDay.toLowerCase())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const isSlotLive = (slotDay: string, startTime: string, endTime: string) => {
    const dayMatches = slotDay.toLowerCase() === currentDayName.toLowerCase();
    if (!dayMatches) return false;

    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    return now >= (startH * 60 + startM) && now <= (endH * 60 + endM);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <Calendar className="w-7 h-7 text-indigo-600" /> Faculty Timetable
            </h2>
            <p className="text-slate-500 text-sm font-medium">Synchronized academic schedule with real-time session tracking.</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end mr-4">
                <span className="text-[9px] font-black tracking-widest text-indigo-500 uppercase">Institutional Clock</span>
                <span className="text-xs text-slate-400 font-bold italic">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-slate-100">
                <button className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-indigo-600"><Share2 className="w-4 h-4" /></button>
                <button className="p-2 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-indigo-600"><Printer className="w-4 h-4" /></button>
            </div>
        </div>
      </div>

      {/* Day Swiper */}
      <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-hide no-scrollbar">
        {days.map((day) => {
          const isToday = day.toLowerCase() === currentDayName.toLowerCase();
          const isSelected = selectedDay.toLowerCase() === day.toLowerCase();
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border-2 flex-shrink-0 flex items-center gap-2 relative ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-indigo-100 scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300 hover:text-slate-600'}`}
            >
              {day}
              {isToday && (
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter animate-pulse ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-600 text-white'}`}>
                  Live
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Schedule Container */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-8 min-h-[400px]">
        {loading ? (
          <div className="space-y-4">
             {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height="110px" className="rounded-3xl" />)}
          </div>
        ) : filteredSlots.length > 0 ? (
          <div className="grid grid-cols-1 gap-5">
            {filteredSlots.map((slot) => {
              const matchesLive = isSlotLive(slot.dayOfWeek, slot.startTime, slot.endTime);
              return (
                <div key={slot.uniqueSlotId} className={`p-6 rounded-[2rem] border transition-all duration-500 group flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden ${matchesLive ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-100 ring-2 ring-indigo-500/10' : 'border-slate-50 bg-slate-50/50'}`}>
                  <div className={`absolute top-0 left-0 w-2 h-full bg-indigo-600 transform transition-transform duration-500 ${matchesLive ? 'translate-x-0' : '-translate-x-full group-hover:translate-x-0'}`}></div>
                  
                  <div className="flex items-start md:items-center gap-8 z-10">
                    {/* Time Box */}
                    <div className="min-w-[110px] flex flex-col items-center justify-center p-5 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:border-indigo-500/20 transition-all">
                      <span className="text-[13px] font-black text-slate-800 tracking-tight">{slot.startTime}</span>
                      <div className="w-8 h-[1px] bg-slate-100 my-1.5"></div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{slot.endTime}</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-[0.1em] border border-indigo-100">{slot.grade}</span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-[0.1em]">{slot.subject}</span>
                          {matchesLive && (
                             <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.1em] animate-pulse flex items-center gap-1.5 shadow-sm shadow-indigo-100/50">
                               <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div> ON GOING
                             </span>
                          )}
                      </div>
                      
                      <h3 className={`text-xl font-black transition-colors leading-tight ${matchesLive ? 'text-slate-900' : 'text-slate-800'}`}>
                          {slot.name}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <div className="flex items-center gap-2">
                           <MapPin className="w-3.5 h-3.5 text-amber-500" />
                           <span>Location: {slot.room || "Main Hall"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <Clock className="w-3.5 h-3.5 text-indigo-400" />
                           <span>Term: Active</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 z-10 self-end md:self-center">
                     <Link 
                      href={`/teacher/attendance/mark?classId=${slot.classId}`} 
                      className={`flex items-center gap-3 px-7 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${matchesLive ? 'bg-primary text-white hover:bg-primary-dark shadow-[0_10px_30px_-10px_rgba(29,158,117,0.4)]' : 'bg-white border-2 border-slate-100 text-slate-600 hover:border-primary/30 hover:text-primary group-hover:shadow-lg'}`}
                     >
                       {matchesLive ? 'Start Session' : 'View Records'} <ArrowRight className="w-3.5 h-3.5" />
                     </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center flex flex-col items-center bg-slate-50/30 rounded-[3rem] border-4 border-dotted border-slate-100">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md mb-6">
              <Calendar className="w-8 h-8 text-slate-200" />
            </div>
            <h3 className="text-xl font-black text-slate-700">Empty Docket</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-sm font-medium leading-relaxed">No active class modules assigned for {selectedDay}. Enjoy your academic downtime or prepare for scheduled sessions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
