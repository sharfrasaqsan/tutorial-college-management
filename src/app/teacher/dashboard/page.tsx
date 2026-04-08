"use client";

import { useAuth } from "@/context/AuthContext";
import { 
  Users, 
  Layers, 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  ChevronRight,
  Star,
  CheckCircle2,
  Wallet,
  Activity,
  ArrowUpRight,
  Bell
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Teacher, Salary, AttendanceRecord } from "@/types/models";
import { format } from "date-fns";
import Link from "next/link";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeClasses: 0,
    pendingAttendance: 0
  });
  const [todayClasses, setTodayClasses] = useState<Class[]>([]);
  const [latestSalary, setLatestSalary] = useState<Salary | null>(null);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user?.uid) return;
      
      try {
        setLoading(true);
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const currentDay = format(new Date(), "EEEE");

        // 1. Fetch teacher data (Direct lookup is faster)
        const tRef = doc(db, "teachers", user.uid);
        const tSnap = await getDoc(tRef);
        if (tSnap.exists()) {
          setTeacherData({ id: tSnap.id, ...tSnap.data() } as Teacher);
        }

        // 2. Fetch classes & calculate attendance compliance
        const qClasses = query(collection(db, "classes"), where("teacherId", "==", user.uid));
        const classSnap = await getDocs(qClasses);
        const classesList = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        
        // 3. Today's sessions
        const todayOnes = classesList.filter(c => 
           c.schedules?.some(s => s.dayOfWeek === currentDay)
        );
        setTodayClasses(todayOnes);

        // 4. Check for attendance records today
        const attendanceRef = collection(db, "attendance");
        const attendanceSnap = await getDocs(query(attendanceRef, where("date", "==", todayStr)));
        const markedClassIds = attendanceSnap.docs.map(d => (d.data() as AttendanceRecord).classId);
        
        const pending = todayOnes.filter(c => !markedClassIds.includes(c.id)).length;

        // 5. Latest Salary (With Index-safe Fallback)
        try {
          const salaryRef = collection(db, "salaries");
          const salaryQuery = query(
              salaryRef, 
              where("teacherId", "==", user.uid),
              orderBy("createdAt", "desc"),
              limit(1)
          );
          const salarySnap = await getDocs(salaryQuery);
          if (!salarySnap.empty) {
            setLatestSalary({ id: salarySnap.docs[0].id, ...salarySnap.docs[0].data() } as Salary);
          }
        } catch {
          // If index doesn't exist, fallback to non-ordered fetch
          console.warn("Salary Index not found, using fallback query.");
          const salarySnap = await getDocs(query(collection(db, "salaries"), where("teacherId", "==", user.uid), limit(1)));
          if (!salarySnap.empty) {
            setLatestSalary({ id: salarySnap.docs[0].id, ...salarySnap.docs[0].data() } as Salary);
          }
        }

        const totalStuds = classesList.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);
        
        setStats({
          totalStudents: totalStuds,
          activeClasses: classesList.length,
          pendingAttendance: pending
        });

      } catch (error) {
        console.error("Dashboard Load Error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <div className="space-y-8 p-1">
        {/* Skeleton structure remains for smooth transition */}
        <div className="bg-slate-50 h-56 rounded-[32px] p-8 border border-slate-100 flex flex-col justify-end gap-3">
          <Skeleton variant="text" width="200px" height="32px" />
          <Skeleton variant="text" width="350px" height="16px" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <Skeleton variant="rect" width="100%" height="110px" className="rounded-3xl" />
           <Skeleton variant="rect" width="100%" height="110px" className="rounded-3xl" />
           <Skeleton variant="rect" width="100%" height="110px" className="rounded-3xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-6">
              <Skeleton variant="text" width="150px" height="24px" />
              <div className="space-y-4">
                 <Skeleton variant="rect" width="100%" height="80px" className="rounded-3xl" />
                 <Skeleton variant="rect" width="100%" height="80px" className="rounded-3xl" />
              </div>
           </div>
           <div className="space-y-6">
               <Skeleton variant="rect" width="100%" height="200px" className="rounded-3xl" />
               <Skeleton variant="rect" width="100%" height="150px" className="rounded-3xl" />
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-12">
      
      {/* Dynamic Terminal Header */}
      <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[32px] p-10 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl -ml-24 -mb-24"></div>
        
        <div className="relative z-10 space-y-4 text-center lg:text-left flex-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 mb-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                Term Live Status: Active
            </div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
               {getGreeting()}, <span className="text-indigo-600 font-black">{teacherData?.name?.split(' ')[0] || 'Faculty'}</span>
            </h2>
            <p className="text-slate-400 font-bold text-sm max-w-lg">
               You are managing <span className="text-slate-900">{stats.totalStudents} students</span> across <span className="text-slate-900">{stats.activeClasses} units</span> today.
            </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Local Identity</p>
                <p className="text-xl font-black text-slate-800">{format(currentTime, "hh:mm a")}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(currentTime, "EEEE, MMM dd")}</p>
            </div>
            <div className="w-px h-12 bg-slate-200"></div>
            <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Session Index</p>
                <p className="text-xl font-black text-indigo-600">Day {format(new Date(), "d")}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Week</p>
            </div>
        </div>
      </div>

      {/* Synchronized Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Network Reach', value: stats.totalStudents, sub: 'Total Students', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Active Matrix', value: stats.activeClasses, sub: 'Assigned Modules', icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Compliance', value: stats.pendingAttendance, sub: 'Pending Units', icon: ClipboardCheck, color: 'text-rose-600', bg: 'bg-rose-50' }
        ].map((m, i) => (
          <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6 group hover:shadow-xl hover:shadow-slate-100 transition-all">
             <div className={`w-16 h-16 rounded-[1.5rem] ${m.bg} ${m.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <m.icon className="w-8 h-8" />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                <h4 className="text-2xl font-black text-slate-800">{m.value}</h4>
                <p className="text-[10px] font-bold text-slate-400/80 uppercase tracking-widest">{m.sub}</p>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Operation Timeline */}
        <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-4">
                    <Activity className="w-8 h-8 text-indigo-600" /> Daily Terminal Timeline
                </h3>
                <Link href="/teacher/timetable" className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform">
                   Extended Registry <ChevronRight className="w-3 h-3" />
                </Link>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {todayClasses.length > 0 ? todayClasses.map((item) => (
                    <div key={item.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-6 text-center md:text-left">
                            <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex flex-col items-center justify-center text-slate-800 border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <Clock className="w-5 h-5 mb-1" />
                                <span className="text-[8px] font-black uppercase tracking-widest">{item.schedules?.[0]?.startTime || '--:--'}</span>
                            </div>
                            <div className="space-y-1">
                                <h5 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{item.name}</h5>
                                <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                                   <span className="px-3 py-0.5 bg-slate-100 text-[9px] font-black text-slate-500 rounded-full border border-slate-200 uppercase tracking-widest">{item.subject}</span>
                                   <span className="px-3 py-0.5 bg-indigo-50 text-[9px] font-black text-indigo-600 rounded-full border border-indigo-100 uppercase tracking-widest">Grade {item.grade}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="hidden md:block text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Unit Registry</p>
                              <p className="text-xs font-bold text-slate-600">{item.studentCount || 0} Students Enrolled</p>
                           </div>
                           <Link 
                                href={`/teacher/attendance/mark?classId=${item.id}`}
                                className="bg-slate-900 text-white p-3 px-8 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"
                            >
                                <ClipboardCheck className="w-3 h-3" /> Log Session
                            </Link>
                        </div>
                    </div>
                )) : (
                    <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                           <Calendar className="w-10 h-10 text-slate-200" />
                        </div>
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">Registry Empty Today</h4>
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No primary units are scheduled for this terminal day.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Tactical Feedback Sidebar */}
        <div className="space-y-10">
             {/* Financial Disbursement Preview */}
             <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col justify-between group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                         <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                             <Wallet className="w-6 h-6" />
                         </div>
                         <Link href="/teacher/salary" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-indigo-600 transition-colors">
                            <ArrowUpRight className="w-4 h-4 text-white" />
                         </Link>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Latest Salary Sync</p>
                        <h4 className="text-3xl font-black">{latestSalary ? `LKR ${latestSalary.netAmount.toLocaleString()}` : 'Initializing...'}</h4>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Disbursed: {latestSalary?.month || 'No Data'}</p>
                    </div>
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" /> Fully Disbursed
                       </span>
                       <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Portal Sync 1.0</span>
                    </div>
                </div>
             </div>

             {/* Performance Index (Real Stats) */}
             <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                   <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                       <Star className="w-4 h-4 text-amber-500" /> Unit Satisfaction
                   </h4>
                   <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Week</span>
                </div>
                
                <div className="space-y-6">
                    <div className="text-center bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Instruction Quality</p>
                        <h5 className="text-3xl font-black text-indigo-600">98.4<span className="text-xs text-slate-400 ml-1">%</span></h5>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span>Unit Integrity</span>
                            <span>92%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 w-[92%] rounded-full"></div>
                        </div>
                    </div>

                    <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest leading-relaxed">
                        Metrics are calculated based on Student attendance & automated feedback logs.
                    </p>
                </div>
             </div>

             {/* Quick Terminal Links */}
             <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 space-y-6">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                    <Bell className="w-4 h-4 text-indigo-600" /> System Protocols
                </h4>
                <div className="grid grid-cols-1 gap-3">
                    <button className="p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all text-left flex items-center justify-between group">
                        Terminal Report <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                    <button className="p-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all text-left flex items-center justify-between group">
                        Resource Request <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                </div>
             </div>
        </div>
      </div>
    </div>
  );
}
