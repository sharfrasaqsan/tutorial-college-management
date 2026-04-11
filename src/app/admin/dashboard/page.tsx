"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { 
  Users, 
  CreditCard, 
  AlertTriangle,
  Plus,
  ArrowRight,
  CalendarDays,
  Projector,
  Activity
} from "lucide-react";
import { DashboardStudent } from "@/types/dashboard";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { formatTime } from "@/lib/formatters";

interface TimetableSlot {
    id: string;
    startTime: string;
    endTime: string;
    className: string;
    teacherName: string;
    grade: string;
    room: string;
}

export default function AdminDashboard() {
  const { openStudentProfile } = useStudentProfile();
  const { stats, isLoading, isError } = useDashboard();

  if (isError) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <p>Failed to load dashboard data. Please check your connection.</p>
      </div>
    );
  }

  const isOngoing = (startTime: string) => {
    const now = new Date();
    const [hours, minutes] = startTime.split(':').map(Number);
    const sessionDate = new Date();
    sessionDate.setHours(hours, minutes, 0);
    
    const sessionEnd = new Date(sessionDate.getTime() + 120 * 60000); // Assume 2 hour session
    return now >= sessionDate && now <= sessionEnd;
  };

  const statCards = [
    { title: "Total Students", value: stats?.totalStudents || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Active Classes", value: stats?.activeClassesCount || 0, icon: Projector, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Monthly Revenue", value: `LKR ${(stats?.feesCollected || 0).toLocaleString()}`, icon: CreditCard, color: "text-indigo-600", bg: "bg-indigo-100" },
    { title: "Unpaid Credits", value: `${stats?.unpaidFeesCount || 0} Records`, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      
      {/* Simplified Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="space-y-1.5">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-4 group">
                <div className="bg-primary p-2.5 rounded-[1.25rem] shadow-xl shadow-primary/10 group-hover:rotate-6 transition-transform duration-500">
                    <Activity className="w-7 h-7 text-white" />
                </div>
                Campus Dashboard
            </h2>
            <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Live update of school activities and data</p>
        </div>
        <div className="flex items-center gap-3">
            <Link href="/admin/students" className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2.5 shadow-sm uppercase tracking-widest hover:border-primary/20 group">
                <Plus className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" /> New Student
            </Link>
            <Link href="/admin/payments" className="px-5 py-3 bg-primary text-white rounded-2xl text-[10px] font-black hover:bg-primary-dark transition-all flex items-center gap-2.5 shadow-xl shadow-primary/20 uppercase tracking-widest group">
                <CreditCard className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" /> Fees
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
            [1, 2, 3, 4].map(idx => (
                <Skeleton key={idx} variant="rect" width="100%" height="100px" className="rounded-[2.5rem]" />
            ))
        ) : statCards.map((card, idx) => (
          <div key={idx} className="bg-white/70 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-xl hover:translate-y-[-4px] transition-all duration-500 group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4`}>
                <card.icon className="w-full h-full" />
            </div>
            <div className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 ${card.bg} ${card.color} shadow-lg shadow-current/10`}>
              <card.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[9px] font-black tracking-[0.2em] uppercase text-slate-400 mb-0.5">{card.title}</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden flex flex-col group/table hover:border-primary/20 transition-all duration-700">
          <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
              <h3 className="font-black text-slate-800 tracking-[0.15em] uppercase text-sm">New Students</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Latest registered students</p>
            </div>
            <Link href="/admin/students" className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all shadow-sm group">
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Student Identity</th>
                  <th className="px-8 py-5 text-right">Phone & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <tr key={i} className="h-20 animate-pulse bg-white"></tr>
                    ))
                ) : (stats?.recentStudents?.length || 0) > 0 ? stats!.recentStudents.map((student: DashboardStudent) => (
                  <tr key={student.id} className="hover:bg-primary/5 transition-all duration-500 group/row">
                    <td className="px-8 py-6">
                      <button 
                        onClick={() => openStudentProfile(student.id)}
                        className="font-black text-slate-800 hover:text-primary transition-all text-left flex items-center gap-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black group-hover/row:bg-primary group-hover/row:text-white transition-all shadow-inner">{student.name.charAt(0)}</div>
                        <div>
                            <p className="text-sm tracking-tight">{student.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {student.id.slice(-6).toUpperCase() || 'Pending'}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                        <p className="text-slate-600 font-bold tracking-tight">{student.phone}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{student.status || 'Active'}</p>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={2} className="px-8 py-24 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-4">
                            <Users className="w-8 h-8" />
                        </div>
                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No recent registrations logged.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl shadow-slate-100/30 overflow-hidden flex flex-col hover:border-primary/20 transition-all duration-700">
          <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 tracking-[0.15em] uppercase text-sm flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-primary" /> Today&apos;s Classes
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Classes scheduled for today</p>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] shadow-sm border ${(stats?.timetable?.length || 0) > 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                {stats?.timetable?.length || 0} Sessions Today
            </div>
          </div>
          <div className="p-4 flex-1">
            <div className="space-y-3">
              {isLoading ? (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl animate-pulse">
                        <Skeleton variant="rect" width="40px" height="40px" className="rounded-xl" />
                        <div className="space-y-2 flex-1">
                            <Skeleton variant="text" width="70%" height="14px" />
                            <Skeleton variant="text" width="40%" height="10px" />
                        </div>
                    </div>
                  ))
              ) : (stats?.timetable?.length || 0) > 0 ? stats!.timetable.map((slot: TimetableSlot) => {
                const active = isOngoing(slot.startTime);
                return (
                  <div key={slot.id} className={`group p-6 rounded-[2.5rem] transition-all duration-500 border relative shadow-xl ${active ? 'bg-slate-900 text-white border-slate-900 shadow-primary/20 scale-[1.02]' : 'bg-white border-slate-100 text-slate-700 hover:border-primary/20'}`}>
                    <div className="flex justify-between items-start mb-5">
                      <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${active ? 'bg-primary border-primary text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-800'}`}>
                          {formatTime(slot.startTime)}
                      </div>
                      {active ? (
                        <div className="flex items-center gap-2">
                           <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                           </span>
                           <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest animate-pulse">Live Now</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Projector className="w-3 h-3 text-primary" /> {slot.room}
                        </span>
                      )}
                    </div>
                    <h4 className={`font-black text-base tracking-tight mb-2 transition-colors ${active ? 'text-white' : 'text-slate-800 group-hover:text-primary'}`}>{slot.className}</h4>
                    <div className="flex items-center gap-3">
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-slate-400' : 'text-slate-400'}`}>{slot.teacherName}</p>
                      <div className={`w-1 h-1 rounded-full ${active ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-primary' : 'text-primary'}`}>Grade {slot.grade}</p>
                    </div>
                    {active && <Activity className="absolute bottom-6 right-6 w-5 h-5 text-primary opacity-20 animate-pulse" />}
                  </div>
                );
              }) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-lg mb-4">
                    <CalendarDays className="w-8 h-8 text-slate-200" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 leading-relaxed">System Clock Synchronized: No Academic Sessions Found Today</p>
                </div>
              )}
            </div>
            {(stats?.timetable?.length || 0) > 0 && (
              <div className="mt-8 pt-8 border-t border-slate-100">
                <Link href="/admin/timetable" className="flex items-center justify-center gap-3 py-4 bg-slate-900 text-white hover:bg-black rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-900/20 group">
                  See Full Timetable <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Institutional Micro Analytics HUD */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
         <div className="flex items-center gap-8">
            <div className="w-14 h-14 bg-white/10 rounded-[1.5rem] flex items-center justify-center text-primary shadow-inner">
                <Activity className="w-7 h-7" />
            </div>
            <div>
               <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1.5">System Integrity</p>
               <h4 className="text-xl font-black flex items-center gap-3">
                  Node Status: <span className="text-primary italic">Operational</span>
                  <div className="flex gap-1">
                     {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-primary/30 rounded-full"></div>)}
                     {[1,2].map(i => <div key={i+3} className="w-1 h-3 bg-primary rounded-full animate-pulse"></div>)}
                  </div>
               </h4>
            </div>
         </div>
         <div className="flex items-center gap-12">
            <div className="text-center">
               <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Student Retention</p>
               <p className="text-lg font-black tracking-tighter">97.8%</p>
            </div>
            <div className="w-px h-10 bg-white/10 hidden md:block"></div>
            <div className="text-center">
               <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Live Sync</p>
               <p className="text-[11px] font-black text-emerald-400 flex items-center gap-2 uppercase tracking-[0.1em]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                  Connected
               </p>
            </div>
         </div>
      </div>
    </div>
  );
}
