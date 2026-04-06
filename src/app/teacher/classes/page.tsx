"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen, Users, Calendar, Clock, MapPin, ChevronRight, Activity, ClipboardCheck } from "lucide-react";
import { Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function MyClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeacherClasses() {
      if (!user?.uid) return;
      try {
        const q = query(collection(db, "classes"), where("teacherId", "==", user.uid));
        const snap = await getDocs(q);
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        console.error("Error loading teacher classes", error);
      } finally {
        setLoading(false);
      }
    }
    loadTeacherClasses();
  }, [user]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-indigo-600" /> Academic Portfolio
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">Manage your scheduled sessions, track batch progress, and initiate attendance logging for your assigned students.</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest">Active ({classes.length} Session{classes.length === 1 ? '' : 's'})</div>
            <div className="px-4 py-2 text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest cursor-not-allowed">Archived (0)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-white rounded-3xl animate-pulse"></div>)
        ) : classes.length > 0 ? classes.map((item) => (
          <div key={item.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/40 transition-all group overflow-hidden border-b-4 border-b-transparent hover:border-b-indigo-600">
            <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-500">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100`}>
                            Active
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Status
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h3 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{item.name}</h3>
                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                        <span>{item.subject}</span>
                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                        <span className="text-indigo-500">{item.grade} Batch</span>
                    </div>
                </div>

                <div className="space-y-3 mb-8 pt-6 border-t border-slate-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Students</p>
                                <p className="text-sm font-bold text-slate-700">
                                  {item.studentCount || 0} Student{item.studentCount === 1 ? '' : 's'} registered
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Weekly Schedule</p>
                        {item.schedules?.map((schedule, idx) => (
                            <div key={idx} className="grid grid-cols-2 gap-4 p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                                <div className="flex items-center gap-2.5">
                                    <Calendar className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xs font-bold text-slate-700 capitalize">{schedule.dayOfWeek}</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Clock className="w-4 h-4 text-indigo-400" />
                                    <span className="text-xs font-bold text-slate-700">{schedule.startTime} - {schedule.endTime}</span>
                                </div>
                                <div className="col-span-2 flex items-center gap-2.5 pt-1 border-t border-slate-100/50">
                                    <MapPin className="w-4 h-4 text-amber-500" />
                                    <span className="text-[11px] font-medium text-slate-500">{schedule.room || 'Main Hall'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link 
                        href={`/teacher/attendance/mark?classId=${item.id}`}
                        className="flex-1 bg-slate-900 text-white rounded-2xl py-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100/50"
                    >
                        <ClipboardCheck className="w-4 h-4" /> Log Attendance
                    </Link>
                    <button className="w-14 h-14 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-colors">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-40 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
            <BookOpen className="w-16 h-16 text-slate-100 mx-auto mb-6" />
            <p className="text-slate-500 font-bold tracking-tight text-xl mb-2">No assigned classes found.</p>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">Please contact the administration office if you believe there is an error in your scheduling.</p>
          </div>
        )}
      </div>
    </div>
  );
}
