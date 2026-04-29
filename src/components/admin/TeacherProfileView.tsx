"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, 
  BookOpen, Clock, Calendar, Activity,
  ArrowUpRight, Loader2, Briefcase, Award, Hash, Download
} from "lucide-react";
import { Teacher, Class, Salary, AttendanceRecord } from "@/types/models";
import { formatTime } from "@/lib/formatters";
import Skeleton from "@/components/ui/Skeleton";
import ClassProfileModal from "@/components/admin/ClassProfileModal";

interface TeacherProfileViewProps {
  teacherId: string;
}

export default function TeacherProfileView({ teacherId }: TeacherProfileViewProps) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<Class[]>([]);
  const [recentSalaries, setRecentSalaries] = useState<Salary[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'attendance' | 'financials' | 'administration'>('overview');
  const [selectedMonth, setSelectedMonth] = useState("all");
  
  // Class Profile View State
  const [isClassViewOpen, setIsClassViewOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const loadTeacherData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Teacher Basic Info
      const tDoc = await getDoc(doc(db, "teachers", teacherId));
      if (!tDoc.exists()) {
        setLoading(false);
        return;
      }
      const tData = { id: tDoc.id, ...tDoc.data() } as Teacher;
      setTeacher(tData);

      // 2. Fetch Assigned Classes
      const classQuery = query(collection(db, "classes"), where("teacherId", "==", teacherId));
      const classSnap = await getDocs(classQuery);
      setAssignedClasses(classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));

      // 3. Fetch Recent Salaries
      const salaryQuery = query(
        collection(db, "salaries"), 
        where("teacherId", "==", teacherId),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const salarySnap = await getDocs(salaryQuery);
      setRecentSalaries(salarySnap.docs.map(d => ({ id: d.id, ...d.data() } as Salary)));

      // 4. Fetch Recent Attendance (Session Completions)
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("teacherId", "==", teacherId),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      setAttendanceRecords(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));

    } catch (error) {
      console.error("Error loading teacher profile:", error);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  const filteredAttendance = useMemo(() => {
    return attendanceRecords.filter(r => {
      if (selectedMonth === "all") return true;
      return r.date.startsWith(selectedMonth);
    });
  }, [attendanceRecords, selectedMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set(attendanceRecords.map(r => r.date.substring(0, 7)));
    return Array.from(months).sort().reverse();
  }, [attendanceRecords]);

  useEffect(() => {
    if (teacherId) {
      setActiveTab('overview');
      loadTeacherData();
    }
  }, [teacherId, loadTeacherData]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex flex-col pb-20">
        <div className="flex items-center justify-between mb-6">
            <button 
                onClick={() => router.back()} 
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all shadow-sm border border-slate-200"
            >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
        </div>
      <div className="w-full flex flex-col gap-6">
        
        {/* Header */}
        <div className="px-8 py-6 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : teacher?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {loading ? <Skeleton variant="text" width="180px" height="24px" /> : teacher?.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> ID: {loading ? "..." : teacher?.teacherId || teacher?.id.substring(0,8).toUpperCase()}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${teacher?.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {loading ? "..." : teacher?.status}
                         </span>
                    </div>
                </div>
            </div>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 shrink-0 scrollbar-hide overflow-x-auto">
            {(['overview', 'classes', 'attendance', 'financials', 'administration'] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => {
                        setActiveTab(tab);
                        setSelectedMonth("all");
                    }}
                    className={`px-5 py-2.5 text-sm font-semibold transition-all rounded-xl capitalize shrink-0 ${activeTab === tab ? 'bg-primary text-white shadow-md' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200 shadow-sm'}`}
                >
                    {tab === 'overview' ? 'Overview' : tab === 'classes' ? 'Classes' : tab === 'attendance' ? 'Attendance' : tab === 'financials' ? 'Payments' : 'Profile'}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                    </div>
                </div>
            ) : teacher && (
                <div className="min-h-[400px] animate-in fade-in duration-500">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-10">
                            {/* KPI Board */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Classes', value: assignedClasses.length, icon: Clock, color: 'bg-primary/5 text-primary border-primary/10' },
                                    { label: 'Subjects', value: (teacher.subjects?.length || 1), icon: BookOpen, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                    { label: 'NIC Number', value: teacher.nic || 'Verified', icon: Award, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                    { label: 'Teacher since', value: formatDate(teacher.createdAt), icon: Calendar, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                ].map((stat, i) => (
                                    <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${stat.color}`}>
                                        <stat.icon className="w-4 h-4" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">{stat.label}</p>
                                            <p className="text-base font-bold tracking-tight">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Teacher Details</h4>
                                        <div className="space-y-6">
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Mail className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Email</p>
                                                    <p className="text-sm font-semibold text-slate-800">{teacher.email || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Phone className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Phone Number</p>
                                                    <p className="text-sm font-semibold text-slate-800 tracking-tight">{teacher.phone || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><MapPin className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Home Address</p>
                                                    <p className="text-sm font-semibold text-slate-800 leading-relaxed">{teacher.address || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                   <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Professional Summary</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50 hover:border-primary/20 transition-colors">
                                                <span className="text-xs font-semibold text-slate-500">Department</span>
                                                <span className="text-xs font-bold text-slate-800 uppercase">{teacher.subjects?.[0] || 'Gen'} Science</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50 hover:border-primary/20 transition-colors">
                                                <span className="text-xs font-semibold text-slate-500">Classes</span>
                                                <span className="text-xs font-black text-primary px-2 bg-primary/5 rounded">{assignedClasses.length} Units</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50 hover:border-primary/20 transition-colors">
                                                <span className="text-xs font-semibold text-slate-500">Status</span>
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 rounded uppercase tracking-widest border border-emerald-100">Active</span>
                                            </div>
                                        </div>
                                   </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'classes' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assigned Classes</h4>
                                    <button 
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-slate-100 opacity-50 cursor-not-allowed"
                                    >
                                        <Download className="w-3 h-3" />
                                        Export List
                                    </button>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{assignedClasses.length} Classes</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {assignedClasses.length > 0 ? assignedClasses.map((cls) => (
                                    <div key={cls.id} className="p-5 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all bg-white group flex flex-col justify-between min-h-[140px]">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all flex items-center justify-center">
                                                    <BookOpen className="w-5 h-5" />
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        setSelectedClassId(cls.id);
                                                        setIsClassViewOpen(true);
                                                    }}
                                                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-300 hover:text-primary transition-colors"
                                                >
                                                    <ArrowUpRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div 
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    setSelectedClassId(cls.id);
                                                    setIsClassViewOpen(true);
                                                }}
                                            >
                                                <h5 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{cls.name.split(' (')[0]}</h5>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{cls.subject} • {cls.grade}</p>
                                            </div>

                                            {cls.schedules && cls.schedules.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Class Timetable</p>
                                                    {cls.schedules.map((s, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                            <Clock className="w-3 h-3 text-primary/40" />
                                                            <span>{s.dayOfWeek} • {formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No assigned cohorts detected</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'attendance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Session Completions</h4>
                                    <button 
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-[10px] font-bold uppercase tracking-widest border border-slate-200"
                                    >
                                        <Download className="w-3 h-3" />
                                        Export History
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                    >
                                        <option value="all">All Sessions</option>
                                        {availableMonths.map(m => (
                                            <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>
                                        ))}
                                    </select>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{filteredAttendance.length} Sessions</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Date & Time</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Academic Unit</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Headcount</th>
                                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredAttendance.length > 0 ? filteredAttendance.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50/30 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                                                            <Calendar className="w-4 h-4" />
                                                        </div>
                                                        <span className="font-semibold text-slate-700">{formatDate(record.date)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <p className="font-bold text-slate-800">{record.className}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{record.grade} • {record.subject}</p>
                                                </td>
                                                <td className="px-6 py-3 font-semibold text-slate-600">
                                                    {record.totalPresent} Present / {record.totalPresent + record.totalAbsent} Total
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black ${
                                                        (record.totalPresent / (record.totalPresent + record.totalAbsent)) >= 0.8 
                                                        ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {Math.round((record.totalPresent / (record.totalPresent + record.totalAbsent)) * 100)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                                                    No session records found for this period
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Payment History</h4>
                                    <button 
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download Ledger
                                    </button>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{recentSalaries.length} Records</span>
                             </div>
                             <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Month</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentSalaries.length > 0 ? recentSalaries.map((sal) => (
                                            <tr key={sal.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-5 font-semibold text-slate-700 capitalize">{sal.month}</td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${sal.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                        {sal.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-slate-800">LKR {sal.netAmount.toLocaleString()}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-16 text-center text-slate-400 font-medium italic">No payment records found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    )}

                    {activeTab === 'administration' && (
                        <div className="space-y-10 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Verifications</h4>
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-xl border border-slate-100 bg-emerald-50/30 flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Award className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-none mb-1">Identity Verified</p>
                                                    <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest">NIC: {teacher.nic}</p>
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-xl border border-slate-100 bg-blue-50/30 flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><Hash className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-none mb-1">Account Type</p>
                                                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-widest">Teacher</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">System Info</h4>
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Registered Date</span>
                                                <span className="font-bold text-slate-800">{formatDate(teacher.createdAt)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-500 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Account Status</span>
                                                <span className="text-[10px] font-black text-emerald-600 px-2 bg-emerald-50 rounded uppercase tracking-widest animate-pulse">Online</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>

      <ClassProfileModal 
        isOpen={isClassViewOpen}
        onClose={() => {
            setIsClassViewOpen(false);
            setSelectedClassId(null);
        }}
        classId={selectedClassId || ""}
      />
    </div>
  );
}
