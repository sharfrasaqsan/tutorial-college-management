"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarDays, Clock, MapPin, Layers, BookOpen, ChevronLeft, ChevronRight, Share2, Printer } from "lucide-react";
import { Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export default function TimetablePage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSchedule() {
      if (!user?.uid) return;
      try {
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
    (cls.schedules || []).map(schedule => ({
      ...cls,
      ...schedule,
      classId: cls.id,
      uniqueSlotId: `${cls.id}-${schedule.dayOfWeek}-${schedule.startTime}`
    }))
  );

  const getSlotsForDay = (day: string) => {
    return allSlots.filter(slot => slot.dayOfWeek.toLowerCase() === day.toLowerCase())
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <CalendarDays className="w-8 h-8 text-indigo-600" /> Weekly Schedule
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">Your academic timetable for the current term. All times are based on the standard institutional clock.</p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
            <button className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600"><Share2 className="w-5 h-5" /></button>
            <button className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-indigo-600"><Printer className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {days.map((day) => {
          const daySlots = getSlotsForDay(day);
          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === day;

          return (
            <div key={day} className={`flex flex-col gap-4 p-6 rounded-[2.5rem] border transition-all ${isToday ? 'bg-indigo-600 border-indigo-700 shadow-xl shadow-indigo-200 ring-8 ring-indigo-50' : 'bg-white border-slate-100 shadow-sm group hover:border-indigo-100/50 hover:bg-indigo-50/5'}`}>
               <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-black uppercase tracking-[0.2em] text-xs ${isToday ? 'text-indigo-200' : 'text-slate-400'}`}>{day}</h3>
                    {daySlots.length > 0 && <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tighter ${isToday ? 'bg-white/20 text-white border border-white/10' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>{daySlots.length} Sessions</span>}
               </div>

               <div className="space-y-3">
                {loading ? (
                    <div className="h-20 bg-slate-100 rounded-2xl animate-pulse"></div>
                ) : daySlots.length > 0 ? daySlots.map((slot) => (
                    <div key={slot.uniqueSlotId} className={`p-5 rounded-3xl border transition-all group-hover:scale-[1.02] ${isToday ? 'bg-white/10 border-white/10 text-white backdrop-blur-md' : 'bg-white border-slate-100 border-b-4 border-b-slate-50'}`}>
                        <div className="flex flex-col gap-4">
                            <div className="space-y-1">
                                <h4 className="font-bold text-sm tracking-tight leading-none group-hover:text-indigo-600 transition-colors">{slot.name}</h4>
                                <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${isToday ? 'text-indigo-100' : 'text-slate-400'}`}>
                                    <BookOpen className="w-2.5 h-2.5" /> {slot.subject}
                                </div>
                            </div>
                            
                            <div className="space-y-2 pt-4 border-t border-white/5 border-slate-50">
                                <div className={`flex items-center gap-2 text-[10px] font-bold ${isToday ? 'text-white' : 'text-slate-600'}`}>
                                    <Clock className={`w-3 h-3 ${isToday ? 'text-white' : 'text-indigo-600'}`} />
                                    {slot.startTime} - {slot.endTime}
                                </div>
                                <div className={`flex items-center gap-2 text-[10px] font-bold ${isToday ? 'text-indigo-200' : 'text-slate-500'}`}>
                                    <MapPin className="w-3 h-3" />
                                    {slot.room || 'Main Hall'}
                                </div>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
                        <Clock className={`w-8 h-8 mb-2 ${isToday ? 'text-white' : 'text-slate-200'}`} />
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-white' : 'text-slate-300'}`}>No Sessions</p>
                    </div>
                )}
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
