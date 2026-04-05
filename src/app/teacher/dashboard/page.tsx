"use client";

import { useAuth } from "@/context/AuthContext";
import { 
  Users, 
  Layers, 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  ChevronRight,
  TrendingUp,
  Star,
  CheckCircle2
} from "lucide-react";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Teacher } from "@/types/models";
import Link from "next/link";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeClasses: 0,
    pendingAttendance: 0
  });
  const [upcomingClasses, setUpcomingClasses] = useState<Class[]>([]);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.uid) return;
      
      try {
        // Fetch teacher names and subjects
        const tSnap = await getDocs(query(collection(db, "teachers"), where("id", "==", user.uid)));
        if (!tSnap.empty) {
          setTeacherData({ id: tSnap.docs[0].id, ...tSnap.docs[0].data() } as Teacher);
        }

        // Fetch classes for this teacher
        const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid));
        const classSnap = await getDocs(qClasses);
        const classesList = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        
        // Calculate stats
        const totalStuds = classesList.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);
        
        setStats({
          totalStudents: totalStuds,
          activeClasses: classesList.length,
          pendingAttendance: 2 // Sample data
        });

        setUpcomingClasses(classesList.slice(0, 5));
      } catch (error) {
        console.error("Dashboard Load Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-[70vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-indigo-700 h-48 rounded-3xl p-8 flex items-center shadow-xl shadow-indigo-100">
        <div className="relative z-10 space-y-2">
            <h2 className="text-white text-3xl font-black tracking-tight">Bonjour, {teacherData?.name || 'Instructor'}! 👋</h2>
            <p className="text-indigo-100/80 font-medium max-w-md">Your academic session is live. You have {stats.activeClasses} scheduled classes and {stats.totalStudents} students under your guidance.</p>
        </div>
        {/* Abstract background elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-10 -mb-10 blur-2xl"></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all hover:-translate-y-1">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
             <Users className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Impact</p>
            <h4 className="text-2xl font-black text-slate-800">{stats.totalStudents}</h4>
            <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Students Reached</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all hover:-translate-y-1">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
             <Layers className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Active Batches</p>
            <h4 className="text-2xl font-black text-slate-800">{stats.activeClasses} Sessions</h4>
            <p className="text-[10px] text-indigo-500 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Fully Scheduled</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all hover:-translate-y-1">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
             <ClipboardCheck className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Attendance</p>
            <h4 className="text-2xl font-black text-slate-800">{stats.pendingAttendance} Pending</h4>
            <Link href="/teacher/attendance" className="text-[10px] text-amber-600 font-bold underline decoration-2 underline-offset-2">Submit Logs Now</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" /> Upcoming Sessions
                </h3>
                <Link href="/teacher/timetable" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                    Whole Week <ChevronRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {upcomingClasses.length > 0 ? upcomingClasses.map((item) => (
                    <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <span className="text-[10px] font-black uppercase tracking-tighter">{item.dayOfWeek?.substring(0,3)}</span>
                                <Clock className="w-4 h-4" />
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-800">{item.name}</h5>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span>{item.subject}</span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span className="text-indigo-600 font-black">{item.startTime} - {item.endTime}</span>
                                </div>
                            </div>
                        </div>
                        <Link 
                            href={`/teacher/attendance/mark?classId=${item.id}`}
                            className="bg-slate-900 text-white p-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            Mark Attendance
                        </Link>
                    </div>
                )) : (
                    <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-100 text-center">
                        <Calendar className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">No classes scheduled for today.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Sidebar Area */}
        <div className="space-y-8">
             <div className="bg-indigo-900 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
                <div className="relative z-10">
                    <Star className="w-10 h-10 text-yellow-400 mb-4 fill-yellow-400" />
                    <h4 className="text-lg font-bold mb-1">Instructor Performance</h4>
                    <p className="text-indigo-200 text-xs mb-6">Your student satisfaction rate is currently at 98% for this academic term.</p>
                    <div className="h-2 w-full bg-indigo-700/50 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 w-[94%]"></div>
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                        <span>Consistency</span>
                        <span>94.0</span>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-400/10 rounded-full -mr-16 -mt-16"></div>
             </div>

             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Quick Actions
                </h4>
                <div className="grid grid-cols-1 gap-2">
                    <button className="w-full p-3 text-left bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all">Generate Monthly Report</button>
                    <button className="w-full p-3 text-left bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all">Request Supplementary Class</button>
                    <button className="w-full p-3 text-left bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 hover:text-indigo-700 transition-all">Submit Expense Claim</button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
}
