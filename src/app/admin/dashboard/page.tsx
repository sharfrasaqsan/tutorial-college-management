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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Institutional Dashboard</h2>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Real-time academic and financial oversight.</p>
        </div>
        <div className="flex gap-2">
            {!isLoading ? (
                <>
                    <Link href="/admin/students" className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4" /> Add Student
                    </Link>
                    <Link href="/admin/payments" className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                        <CreditCard className="w-4 h-4" /> Collect Fees
                    </Link>
                </>
            ) : (
                <>
                    <Skeleton variant="rect" width="120px" height="38px" className="rounded-xl" />
                    <Skeleton variant="rect" width="150px" height="38px" className="rounded-xl" />
                </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
            [1, 2, 3, 4].map(idx => (
                <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <Skeleton variant="circle" width="48px" height="48px" />
                    <div className="space-y-2">
                        <Skeleton variant="text" width="80px" height="12px" />
                        <Skeleton variant="text" width="60px" height="24px" />
                    </div>
                </div>
            ))
        ) : statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${card.bg} ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">{card.title}</p>
              <p className="text-xl font-black text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 tracking-tight">Recent Enrollments</h3>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Global Student Directory</p>
            </div>
            <Link href="/admin/students" className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-primary hover:text-white transition-all">
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-50">
                <tr>
                  <th className="px-8 py-4">Student Identity</th>
                  <th className="px-8 py-4">Contact Info</th>
                  <th className="px-8 py-4">Academic School</th>
                  <th className="px-8 py-4 text-right">Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <tr key={i}>
                            <td className="px-8 py-5"><Skeleton variant="text" width="120px" height="14px" /></td>
                            <td className="px-8 py-5"><Skeleton variant="text" width="100px" height="14px" /></td>
                            <td className="px-8 py-5"><Skeleton variant="text" width="150px" height="14px" /></td>
                            <td className="px-8 py-5 text-right"><Skeleton variant="rect" width="60px" height="20px" className="ml-auto rounded" /></td>
                        </tr>
                    ))
                ) : (stats?.recentStudents?.length || 0) > 0 ? stats!.recentStudents.map((student: DashboardStudent) => (
                  <tr key={student.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <button 
                        onClick={() => openStudentProfile(student.id)}
                        className="font-bold text-slate-800 hover:text-primary transition-colors text-left flex items-center gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px]">{student.name.charAt(0)}</div>
                        {student.name}
                      </button>
                    </td>
                    <td className="px-8 py-5 text-slate-600 font-medium">{student.phone}</td>
                    <td className="px-8 py-5 text-slate-400 font-medium italic">{student.schoolName}</td>
                    <td className="px-8 py-5 text-right">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {student.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-medium italic">No recent registrations logged.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
            <h3 className="font-bold text-slate-800 tracking-tight">Daily Academic Schedule</h3>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Active Learning Sessions</p>
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
              ) : (stats?.timetable?.length || 0) > 0 ? stats!.timetable.map((slot: any) => {
                const active = isOngoing(slot.startTime);
                return (
                  <div key={slot.id} className={`group p-4 rounded-2xl transition-all border relative shadow-sm ${active ? 'bg-slate-800 text-white border-slate-800 shadow-primary/20' : 'bg-slate-50 text-slate-700 border-transparent hover:border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors border ${active ? 'bg-primary border-primary text-white' : 'bg-white border-slate-100 text-slate-800'}`}>
                          {slot.startTime}
                      </div>
                      {active ? (
                        <div className="flex items-center gap-1.5">
                           <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                           </span>
                           <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest animate-pulse">On Going</span>
                        </div>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{slot.room}</span>
                      )}
                    </div>
                    <h4 className="font-black text-sm tracking-tight">{slot.className}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-slate-400' : 'text-slate-400'}`}>{slot.teacherName}</p>
                      <div className={`w-1 h-1 rounded-full ${active ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                      <p className={`text-[10px] font-bold ${active ? 'text-primary' : 'text-primary'}`}>Grade {slot.grade}</p>
                    </div>
                    {active && <Activity className="absolute bottom-4 right-4 w-4 h-4 text-primary/40" />}
                  </div>
                );
              }) : (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-[24px] border-2 border-dashed border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                    <CalendarDays className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-4">No Academic Sessions Scheduled for Today</p>
                </div>
              )}
            </div>
            {(stats?.timetable?.length || 0) > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <Link href="/admin/timetable" className="flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 transition-all">
                  Open Institutional Matrix <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
