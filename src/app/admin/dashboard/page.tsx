"use client";

import { useDashboard } from "@/hooks/useDashboard";
import { 
  Users, 
  GraduationCap, 
  CreditCard, 
  AlertTriangle,
  Plus,
  ArrowRight,
  Clock,
  CalendarDays
} from "lucide-react";
import { DashboardStudent, DashboardTimetableSlot } from "@/types/dashboard";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";

export default function AdminDashboard() {
  const { stats, isLoading, isError } = useDashboard();

  if (isError) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <p>Failed to load dashboard data. Please check your connection.</p>
      </div>
    );
  }

  const statCards = [
    { title: "Total Students", value: stats?.totalStudents || 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "Total Teachers", value: stats?.totalTeachers || 0, icon: GraduationCap, color: "text-purple-600", bg: "bg-purple-100" },
    { title: "Fees Collected", value: `LKR ${(stats?.feesCollected || 0).toLocaleString()}`, icon: CreditCard, color: "text-success", bg: "bg-green-100" },
    { title: "Unpaid Fees", value: `${stats?.unpaidFeesCount || 0} Students`, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Welcome Back, Admin</h2>
          <p className="text-sm text-slate-500">Here&apos;s what&apos;s happening at the tutorial college today.</p>
        </div>
        <div className="flex gap-2">
            {!isLoading ? (
                <>
                    <Link href="/admin/students" className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4" /> Add Student
                    </Link>
                    <Link href="/admin/payments/record" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20">
                        <CreditCard className="w-4 h-4" /> Record Payment
                    </Link>
                </>
            ) : (
                <>
                    <Skeleton variant="rect" width="120px" height="38px" className="rounded-lg" />
                    <Skeleton variant="rect" width="150px" height="38px" className="rounded-lg" />
                </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
            [1, 2, 3, 4].map(idx => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <Skeleton variant="circle" width="48px" height="48px" />
                    <div className="space-y-2">
                        <Skeleton variant="text" width="80px" height="12px" />
                        <Skeleton variant="text" width="60px" height="24px" />
                    </div>
                </div>
            ))
        ) : statCards.map((card, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="text-2xl font-bold text-slate-800 tracking-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recent Enrollments</h3>
            <Link href="/admin/students" className="text-sm font-medium text-primary hover:text-primary-dark flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-0 flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Student Name</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">School</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <tr key={i}>
                            <td className="px-6 py-4"><Skeleton variant="text" width="120px" height="14px" /></td>
                            <td className="px-6 py-4"><Skeleton variant="text" width="100px" height="14px" /></td>
                            <td className="px-6 py-4"><Skeleton variant="text" width="150px" height="14px" /></td>
                            <td className="px-6 py-4 text-right"><Skeleton variant="rect" width="60px" height="20px" className="ml-auto rounded" /></td>
                        </tr>
                    ))
                ) : (stats?.recentStudents?.length || 0) > 0 ? stats!.recentStudents.map((student: DashboardStudent) => (
                  <tr key={student.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-800">{student.name}</td>
                    <td className="px-6 py-4 text-slate-600">{student.phone}</td>
                    <td className="px-6 py-4 text-slate-600">{student.schoolName}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                        {student.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No recent students found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Today&apos;s Classes</h3>
          </div>
          <div className="p-4 flex-1">
            <div className="space-y-4">
              {isLoading ? (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="flex gap-4 items-start p-3">
                        <Skeleton variant="rect" width="40px" height="40px" className="rounded-xl" />
                        <div className="space-y-2 flex-1">
                            <Skeleton variant="text" width="70%" height="14px" />
                            <Skeleton variant="text" width="40%" height="10px" />
                        </div>
                    </div>
                  ))
              ) : (stats?.timetable?.length || 0) > 0 ? stats!.timetable.map((slot: DashboardTimetableSlot) => (
                <div key={slot.id} className="flex gap-4 items-start p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                  <div className="w-12 flex flex-col items-center justify-center pt-1">
                    <Clock className="w-5 h-5 text-primary mb-1" />
                    <span className="text-xs font-semibold text-slate-600">{slot.startTime}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{slot.classId}</h4>
                    <p className="text-xs text-slate-500 mt-1">Room: {slot.room}</p>
                    <p className="text-xs text-primary mt-1">{slot.teacherId}</p>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-xl">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                    <CalendarDays className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No classes scheduled for today.</p>
                </div>
              )}
            </div>
            {(stats?.timetable?.length || 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                <Link href="/admin/timetable" className="text-sm font-medium text-primary hover:text-primary-dark">
                  View Full Timetable
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
