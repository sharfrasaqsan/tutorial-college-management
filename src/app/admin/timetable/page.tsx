"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Calendar, Clock, Plus, LayoutGrid, List, BookOpen, GraduationCap } from "lucide-react";
import { TimetableSlot } from "@/types/models";

export default function TimetablePage() {
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("grid"); // 'grid' | 'list'
  const [selectedDay, setSelectedDay] = useState("monday");

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  useEffect(() => {
    async function loadTimetable() {
      try {
        const q = query(collection(db, "timetable"), orderBy("startTime", "asc"));
        const snap = await getDocs(q);
        setTimetable(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableSlot)));
      } catch (error) {
        console.error("Error loading timetable", error);
      } finally {
        setLoading(false);
      }
    }
    loadTimetable();
  }, []);

  const filteredTimetable = timetable.filter(t => t.dayOfWeek === selectedDay);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Weekly Timetable</h2>
          <p className="text-sm text-slate-500">Configure and view class schedules across all halls.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button 
              onClick={() => setView("grid")}
              className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20">
            <Plus className="w-4 h-4" /> Create Entry
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTimetable.length > 0 ? (
          <div className="space-y-4">
            {filteredTimetable.map((slot) => (
              <div key={slot.id} className="p-5 rounded-2xl border border-slate-50 hover:border-primary/20 hover:bg-primary/5 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div className="w-24 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 group-hover:bg-primary/10 transition-colors">
                    <Clock className="w-5 h-5 text-primary mb-1" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">{slot.startTime}</span>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{slot.endTime}</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800">{slot.classId}</h3>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Room: {slot.room}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-primary">
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>{slot.teacherId}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-5 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors uppercase tracking-wider">
                    Details
                  </button>
                  <button className="px-5 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors uppercase tracking-wider">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No classes found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">There are no classes scheduled for {selectedDay} yet. Click &quot;Create Entry&quot; to add one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
