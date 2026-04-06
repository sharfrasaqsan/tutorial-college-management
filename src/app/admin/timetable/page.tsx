"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar, Clock, LayoutGrid, List, MapPin, User, GraduationCap, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ClassEntry {
  id: string;
  name: string;
  grade: string;
  subject: string;
  teacherName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
}

export default function TimetablePage() {
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("monday");

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  useEffect(() => {
    async function loadClasses() {
      try {
        setLoading(true);
        const q = query(
          collection(db, "classes"), 
          orderBy("startTime", "asc")
        );
        const snap = await getDocs(q);
        const fetchedClasses = snap.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          } as ClassEntry))
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

  const filteredClasses = classes.filter(c => c.dayOfWeek.toLowerCase() === selectedDay.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Campus Live Timetable</h2>
          <p className="text-sm text-slate-500">Automatically synchronized with all active class schedules.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-black tracking-widest text-primary uppercase">Automatic Sync</span>
            <span className="text-xs text-slate-400 font-medium italic">Read-only view</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
             <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-1">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-6 py-3 rounded-2xl text-sm font-bold capitalize transition-all border-2 flex-shrink-0 ${selectedDay === day ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'}`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
             <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-primary" />
                </div>
             </div>
          </div>
        ) : filteredClasses.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredClasses.map((cls) => (
              <div key={cls.id} className="p-5 rounded-3xl border border-slate-50 bg-slate-50/30 hover:border-primary/20 hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 group flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-primary transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></div>
                
                <div className="flex items-start md:items-center gap-6 z-10">
                  <div className="min-w-[100px] flex flex-col items-center justify-center p-4 rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:border-primary/10 transition-colors">
                    <span className="text-sm font-black text-slate-800 tracking-tight">{cls.startTime}</span>
                    <div className="w-10 h-[1px] bg-slate-200 my-1"></div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{cls.endTime}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">{cls.grade}</span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider">{cls.subject}</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 group-hover:text-primary transition-colors leading-tight">
                        {cls.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-1.5 hover:text-primary transition-colors">
                        <User className="w-4 h-4" />
                        <span>{cls.teacherName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        <span>{cls.room || "Main Hall"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 z-10 self-end md:self-center">
                   <Link 
                    href="/admin/classes" 
                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-slate-50 transition-all group-hover:border-slate-300"
                   >
                     Manage Class <ArrowRight className="w-3.5 h-3.5" />
                   </Link>
                </div>
              </div>
            ))}
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

function PlusIcon(props: any) {
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
