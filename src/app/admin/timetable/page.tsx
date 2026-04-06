"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar, MapPin, User, ArrowRight } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useTeacherProfile } from "@/context/TeacherProfileContext";
import { Class, ClassSchedule } from "@/types/models";

export default function TimetablePage() {
  const { openTeacherProfile } = useTeacherProfile();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Get current day index (0 is Sunday, so we map to our order)
  const jsDayIndex = currentTime.getDay();
  const dayIndexMap = [6, 0, 1, 2, 3, 4, 5]; // sunday=6, monday=0, etc.
  const currentDayName = days[dayIndexMap[jsDayIndex]];
  
  const [selectedDay, setSelectedDay] = useState(currentDayName);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const q = query(
          collection(db, "classes")
        );
        const snap = await getDocs(q);
        const fetchedClasses = snap.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          } as Class))
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
    .filter(slot => slot.dayOfWeek.toLowerCase() === selectedDay.toLowerCase())
    .sort((a, b) => {
      // Sort by start time (HH:MM format)
      return a.startTime.localeCompare(b.startTime);
    });

  const isSlotLive = (slotDay: string, startTime: string, endTime: string) => {
    const dayMatches = slotDay.toLowerCase() === currentDayName.toLowerCase();
    if (!dayMatches) return false;

    const now = currentTime.getHours() * 60 + currentTime.getMinutes();
    const [startH, startM] = startTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const [endH, endM] = endTime.split(':').map(Number);
    const endTotal = endH * 60 + endM;

    return now >= startTotal && now <= endTotal;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campus Live Timetable</h2>
          <p className="text-sm text-slate-500">Automatically synchronized with all active class schedules.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black tracking-widest text-primary uppercase">Current System Time</span>
            <span className="text-xs text-slate-400 font-bold italic">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
             <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-1">
        {days.map((day) => {
          const isCurrentDay = day.toLowerCase() === currentDayName.toLowerCase();
          const isSelected = selectedDay.toLowerCase() === day.toLowerCase();
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-6 py-3 rounded-2xl text-sm font-bold capitalize transition-all border-2 flex-shrink-0 flex items-center gap-2 relative ${isSelected ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
            >
              {day}
              {isCurrentDay && (
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter animate-pulse ${isSelected ? 'bg-white text-primary' : 'bg-primary text-white'}`}>
                  Today
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
        {loading ? (
          <div className="space-y-4">
             {[1, 2, 3].map(i => (
               <div key={i} className="p-5 rounded-3xl border border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-pulse">
                  <div className="flex items-start md:items-center gap-6">
                     <Skeleton variant="rect" width="100px" height="80px" className="rounded-2xl" />
                     <div className="space-y-3">
                        <div className="flex gap-2">
                           <Skeleton variant="rect" width="60px" height="20px" className="rounded-lg" />
                           <Skeleton variant="rect" width="80px" height="20px" className="rounded-lg" />
                        </div>
                        <Skeleton variant="text" width="200px" height="24px" />
                        <div className="flex gap-4">
                           <Skeleton variant="text" width="100px" height="14px" />
                           <Skeleton variant="text" width="80px" height="14px" />
                        </div>
                     </div>
                  </div>
                  <Skeleton variant="rect" width="120px" height="40px" className="rounded-xl" />
               </div>
             ))}
          </div>
        ) : filteredSlots.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredSlots.map((slot) => {
              const isLive = isSlotLive(slot.dayOfWeek, slot.startTime, slot.endTime);
              return (
                <div key={slot.uniqueSlotId} className={`p-5 rounded-3xl border transition-all duration-300 group flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden ${isLive ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10 ring-2 ring-primary/20' : 'border-slate-50 bg-slate-50/30'}`}>
                  <div className={`absolute top-0 left-0 w-2 h-full bg-primary transform transition-transform duration-300 ${isLive ? 'translate-x-0' : '-translate-x-full group-hover:translate-x-0'}`}></div>
                  
                  <div className="flex items-start md:items-center gap-6 z-10">
                    <div className="min-w-[100px] flex flex-col items-center justify-center p-4 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:border-primary/10 transition-colors">
                      <span className="text-sm font-black text-slate-800 tracking-tight">{slot.startTime}</span>
                      <div className="w-10 h-[1px] bg-slate-200 my-1"></div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{slot.endTime}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">{slot.grade}</span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">{slot.subject}</span>
                          {isLive && (
                             <span className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                               <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div> ON GOING
                             </span>
                          )}
                      </div>
                      <h3 className={`text-xl font-black transition-colors leading-tight ${isLive ? 'text-primary' : 'text-slate-800 group-hover:text-primary'}`}>
                          {slot.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                        <button 
                          onClick={() => openTeacherProfile(slot.teacherId)}
                          className="flex items-center gap-1.5 hover:text-primary transition-colors text-left"
                        >
                          <User className="w-4 h-4" />
                          <span>{slot.teacherName}</span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-amber-500" />
                          <span>{slot.room || "Main Hall"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 z-10 self-end md:self-center">
                     <Link 
                      href="/admin/classes" 
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all ${isLive ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 group-hover:border-slate-300'}`}
                     >
                       {isLive ? 'View Ongoing Session' : 'Manage Class'} <ArrowRight className="w-3.5 h-3.5" />
                     </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-24 text-center flex flex-col items-center bg-slate-50/50 rounded-[40px] border-4 border-dotted border-slate-100 transition-all hover:border-primary/20">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 transform group-hover:scale-110 transition-transform">
              <Calendar className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-2xl font-black text-slate-800">Clear Schedule</h3>
            <p className="text-md text-slate-400 mt-2 max-w-sm font-medium">No active classes are synchronized for {selectedDay}. Add new classes in the management section to populate this view.</p>
            <Link href="/admin/classes" className="mt-8 px-8 py-3 bg-primary text-white rounded-2xl text-sm font-black hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 flex items-center gap-2">
               Schedule a Class <PlusIcon className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
