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
  Activity,
  Briefcase,
  History,
  CheckCircle2,
  Clock,
  BookOpen,
  Calendar
} from "lucide-react";
import { DashboardStudent, DashboardTimetableSlot } from "@/types/dashboard";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { formatTime } from "@/lib/formatters";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap as GraduationIcon } from "lucide-react";
import Footer from "@/components/common/Footer";

export default function AdminDashboard() {
  const router = useRouter();
  const { openStudentProfile } = useStudentProfile();
  const { stats, isLoading, isError } = useDashboard();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (isError) {
    return (
      <div className="bg-rose-50 text-rose-600 p-6 rounded-[2rem] border border-rose-100 flex items-center gap-4 animate-in fade-in zoom-in duration-500">
        <AlertTriangle className="w-6 h-6" />
        <div>
           <p className="font-black uppercase tracking-widest text-[10px]">System Error</p>
           <p className="text-sm font-bold">Failed to synchronize dashboard metrics. Verify network connectivity.</p>
        </div>
      </div>
    );
  }

  const isOngoing = (startTime: string, endTime: string) => {
    const now = new Date();
    const [h, m] = startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(h, m, 0);
    
    let end = new Date();
    if (endTime && endTime.includes(':')) {
        const [eh, em] = endTime.split(':').map(Number);
        end.setHours(eh, em + 15, 0); // 15 min buffer
    } else {
        end = new Date(start.getTime() + 120 * 60000); // fallback
    }
    
    return now >= start && now <= end;
  };

  const statCards = [
    { title: "Total Students", value: stats?.totalStudents || 0, icon: Users, color: "text-blue-500", action: () => router.push('/admin/students'), clickable: true },
    { title: "Total Teachers", value: stats?.totalTeachers || 0, icon: Briefcase, color: "text-violet-500", action: () => router.push('/admin/teachers'), clickable: true },
    { title: "Active Classes", value: stats?.activeClassesCount || 0, icon: Projector, color: "text-emerald-500", action: () => router.push('/admin/classes'), clickable: true },
    { title: `Collected Fees`, value: `LKR ${(stats?.feesCollected || 0).toLocaleString()}`, icon: CreditCard, color: "text-indigo-500", action: () => router.push('/admin/payments'), clickable: true },
    { title: `Pending Fees`, value: stats?.unpaidFeesCount || 0, icon: AlertTriangle, color: "text-orange-500", action: () => router.push('/admin/payments'), clickable: true },
    { title: `Unpaid Salary`, value: stats?.pendingSalariesCount || 0, icon: History, color: "text-rose-500", action: () => router.push('/admin/salaries'), clickable: true },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 🏛️ Simple Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
            {mounted ? (
              <>{format(currentTime, "EEEE, dd MMMM")} • {format(currentTime, "hh:mm a")}</>
            ) : (
              <span className="opacity-0">Loading...</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/students" className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2">
              <Plus className="w-3.5 h-3.5" /> Enroll Student
          </Link>
          <Link href="/admin/payments" className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Revenue
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {isLoading ? (
            [1, 2, 3, 4, 5, 6].map(idx => (
                <Skeleton key={idx} variant="rect" width="100%" height="80px" className="rounded-2xl" />
            ))
        ) : statCards.map((card, idx) => (
          <div 
            key={idx} 
            onClick={card.action}
            className={`bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-200 hover:border-primary/30 group ${card.clickable ? 'cursor-pointer active:scale-[0.98]' : ''}`}
          >
            <div className="flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color.replace('text-', 'bg-').split('-').slice(0, 2).join('-')}-50 ${card.color} transition-all shadow-sm`}>
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{card.title}</p>
                <div className="flex items-center gap-1">
                  <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary leading-none transition-colors">{card.value}</p>
                  {card.clickable && <ArrowRight className="w-2.5 h-2.5 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Schedule Today & Pending Payments */}
        <div className="lg:col-span-7 space-y-8">
           {/* 🏛️ Schedule Today */}
           <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-primary/5 transition-all duration-500">
             <div className="px-8 py-8 border-b border-slate-50 bg-white flex items-center justify-between relative group/timeline">
               <div className="flex items-center gap-5">
                  <div className="w-1.5 h-10 bg-primary rounded-full group-hover/timeline:scale-y-110 transition-transform shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"></div>
                  <div>
                     <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Today's Classes</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Live Schedule</p>
                  </div>
               </div>
               <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${(stats?.timetable?.length || 0) > 0 ? 'bg-primary/5 text-primary border-primary/10' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                   {stats?.timetable?.length || 0} Sessions
               </div>
             </div>
             <div className="p-8 flex-1">
               <div className="space-y-4 relative">
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
                 ) : (stats?.timetable?.length || 0) > 0 ? stats!.timetable.map((slot: DashboardTimetableSlot, idx: number) => {
                   const active = isOngoing(slot.startTime, slot.endTime);
                   return (
                     <div key={slot.id} className="relative group flex gap-5">
                       {/* Vertical Line Connector */}
                       {idx !== (stats?.timetable?.length || 0) - 1 && (
                           <div className="absolute left-[39px] top-10 bottom-[-20px] w-px bg-slate-100"></div>
                       )}
                       
                       <div className="flex-shrink-0 w-24 flex flex-col items-center justify-center relative">
                           {slot.isCompleted && (
                               <div className="absolute -left-2 top-0 text-emerald-500 animate-in zoom-in duration-300">
                                   <CheckCircle2 className="w-4 h-4" />
                               </div>
                           )}
                           <div className={`w-full py-1.5 rounded-lg border text-center transition-all ${slot.isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : active ? 'bg-primary border-primary text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                               <p className="text-[10px] font-bold leading-none">{formatTime(slot.startTime)}</p>
                           </div>
                           <div className="w-px h-2 bg-slate-200"></div>
                           <div className={`px-2 py-0.5 rounded-md border text-[9px] font-medium text-center ${slot.isCompleted ? 'bg-emerald-50/50 border-emerald-100 text-emerald-400' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                              {slot.endTime ? formatTime(slot.endTime) : '--:--'}
                           </div>
                       </div>
   
                       <div className={`flex-1 p-4 rounded-2xl border transition-all ${slot.isCompleted ? 'bg-slate-50/80 border-slate-100 opacity-50 grayscale-[0.5]' : active ? 'bg-white border-primary shadow-xl shadow-primary/5' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                           <div className="flex items-center justify-between mb-1.5">
                               <h4 className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors tracking-tight">{slot.className}</h4>
                               {slot.isCompleted ? (
                                   <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20">
                                       <CheckCircle2 className="w-3.5 h-3.5" />
                                       <span>Class done</span>
                                   </div>
                               ) : active && (
                                   <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase animate-pulse">
                                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                       LIVE
                                   </div>
                               )}
                           </div>
                           <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                               <p className="text-[11px] font-medium text-slate-500">{slot.teacherName}</p>
                               <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                               <p className="text-[11px] font-bold text-primary">{slot.grade}</p>
                               <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                               <p className="text-[11px] font-medium text-slate-400">{slot.room}</p>
                           </div>
                       </div>
                     </div>
                   );
                 }) : (
                   <div className="h-48 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-50">
                     <CalendarDays className="w-8 h-8 text-slate-200 mb-3" />
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Sessions Scheduled</p>
                   </div>
                 )}
               </div>
               {(stats?.timetable?.length || 0) > 0 && (
                 <div className="mt-8">
                   <Link href="/admin/timetable" className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all group/link">
                     Detailed Grid View <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                   </Link>
                 </div>
               )}
             </div>
           </div>

           {/* 💳 Pending Student Fees */}
           <div 
             onClick={() => router.push('/admin/payments')}
             className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-rose-50 transition-all duration-500 cursor-pointer group/pay-section active:scale-[0.99]"
           >
              <div className="px-8 py-7 border-b border-slate-50 flex items-center justify-between bg-white relative group/pay">
                <div className="flex items-center gap-5">
                   <div className="w-1.5 h-8 bg-rose-500 rounded-full group-hover/pay:scale-y-110 transition-transform shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                   <div>
                      <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">Pending Student Fees</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1 opacity-80">Unpaid Balances</p>
                   </div>
                </div>
                <div className="px-3 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase tracking-wider">
                    {stats?.unpaidList?.length || 0} Critical
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-4">Student</th>
                      <th className="px-8 py-4">Cycle</th>
                      <th className="px-8 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [1, 2, 3].map(i => <tr key={i} className="h-14 animate-pulse bg-white"></tr>)
                    ) : (stats?.unpaidList?.length || 0) > 0 ? stats!.unpaidList!.slice(0, 5).map((unpaid) => (
                      <tr key={unpaid.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="px-8 py-4 font-bold text-slate-700">{unpaid.studentName}</td>
                        <td className="px-8 py-4 text-slate-400 font-medium uppercase tracking-tighter text-[10px]">{unpaid.month}</td>
                        <td className="px-8 py-4 text-right font-black text-rose-600">LKR {unpaid.amount.toLocaleString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="px-8 py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">No pending arrears detected</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>

           {/* 👨‍🏫 Pending Teacher Salaries */}
           <div 
             onClick={() => router.push('/admin/salaries')}
             className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-amber-50 transition-all duration-500 cursor-pointer group/sal-section active:scale-[0.99]"
           >
              <div className="px-8 py-7 border-b border-slate-50 flex items-center justify-between bg-white relative group/sal">
                <div className="flex items-center gap-5">
                   <div className="w-1.5 h-8 bg-amber-500 rounded-full group-hover/sal:scale-y-110 transition-transform shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
                   <div>
                      <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">Unpaid Teacher Salaries</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mt-1 opacity-80">Pending Payouts</p>
                   </div>
                </div>
                <div className="px-3 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-bold uppercase tracking-wider">
                    {stats?.salaryList?.length || 0} Pending
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-4">Teacher</th>
                      <th className="px-8 py-4">Class</th>
                      <th className="px-8 py-4">Requested</th>
                      <th className="px-8 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      [1, 2].map(i => <tr key={i} className="h-14 animate-pulse bg-white"></tr>)
                    ) : (stats?.salaryList?.length || 0) > 0 ? stats!.salaryList!.slice(0, 5).map((sal) => {
                      const cleanClass = sal.className?.replace(/\s*\([^)]*\)$/, "").trim() || "N/A";
                      const extractedTeacher = sal.className?.match(/\(([^)]+)\)/)?.[1] || sal.teacherName;
                      
                      return (
                        <tr key={sal.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-8 py-4 font-bold text-slate-700">{extractedTeacher}</td>
                          <td className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">{cleanClass}</td>
                          <td className="px-8 py-4 text-slate-400 font-medium uppercase tracking-tighter text-[10px]">{sal.requestDate ? format(new Date(sal.requestDate), 'MMM dd') : 'N/A'}</td>
                          <td className="px-8 py-4 text-right font-black text-amber-600">LKR {sal.amount.toLocaleString()}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={4} className="px-8 py-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">No pending salary requests</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-primary/10 transition-all duration-500">
           <div className="px-8 py-8 border-b border-slate-50 bg-white flex items-center justify-between relative group/tmr">
             <div className="flex items-center gap-5">
                <div className="w-1.5 h-10 bg-indigo-500 rounded-full group-hover/tmr:scale-y-110 transition-transform shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                <div>
                   <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Tomorrow's Classes</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Planned Sessions</p>
                </div>
             </div>
             <div className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold uppercase tracking-wider">
                 {stats?.tomorrowTimetable?.length || 0} Units
             </div>
           </div>
           <div className="p-6 flex-1 overflow-y-auto scrollbar-hide">
             <div className="space-y-4">
               {isLoading ? (
                 [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-2xl"></div>)
               ) : (stats?.tomorrowTimetable?.length || 0) > 0 ? stats!.tomorrowTimetable!.map((slot) => (
                 <div key={slot.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all group flex flex-col justify-between">
                   <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Clock className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-black text-slate-700">{formatTime(slot.startTime)}</p>
                     </div>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">{slot.room}</span>
                   </div>
                   <div>
                     <h5 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{slot.className}</h5>
                     <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{slot.grade}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{slot.teacherName}</span>
                     </div>
                   </div>
                 </div>
               )) : (
                 <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                    <Calendar className="w-10 h-10 text-slate-200" />
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Clear skies for tomorrow</p>
                 </div>
               )}
             </div>
           </div>
           {(stats?.tomorrowTimetable?.length || 0) > 0 && (
              <div className="p-6 pt-0 mt-auto">
                <Link href="/admin/timetable" className="flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-100 hover:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all group/link">
                  Full Grid <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
           )}
        </div>
      </div>

      <Footer />

    </div>
  );
}
