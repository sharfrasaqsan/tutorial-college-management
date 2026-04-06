"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  X, Mail, Phone, MapPin, 
  BookOpen, Clock, Calendar, Activity,
  ArrowUpRight, Loader2, Briefcase, Award, Hash
} from "lucide-react";
import { Teacher, Class, Salary } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";

interface TeacherProfileModalProps {
  teacherId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TeacherProfileModal({ teacherId, isOpen, onClose }: TeacherProfileModalProps) {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignedClasses, setAssignedClasses] = useState<Class[]>([]);
  const [recentSalaries, setRecentSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'financials' | 'administration'>('overview');

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

    } catch (error) {
      console.error("Error loading teacher profile:", error);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    if (isOpen && teacherId) {
      loadTeacherData();
    }
  }, [isOpen, teacherId, loadTeacherData]);

  if (!isOpen) return null;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-none"></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* Header - Professional & Focused */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-black">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : teacher?.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 leading-none">
                        {loading ? <Skeleton variant="text" width="180px" height="24px" /> : teacher?.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                         <div className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded-full border border-primary/10">
                            <Briefcase className="w-3.5 h-3.5" />
                            {loading ? "..." : (teacher?.subjects?.[0] || "COORDINATOR")}
                         </div>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none pt-0.5">
                           ID: {loading ? "..." : teacher?.id.substring(0,8).toUpperCase()}
                         </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Professional Navigation Bar */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1">
            {(['overview', 'classes', 'financials', 'administration'] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-semibold transition-all relative capitalize ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in fade-in slide-in-from-bottom-1"></div>
                    )}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                    </div>
                </div>
            ) : teacher && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-10">
                            {/* KPI Board */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Active Batches', value: assignedClasses.length, icon: Clock, color: 'bg-primary/5 text-primary border-primary/10' },
                                    { label: 'Tutoring Subjects', value: (teacher.subjects?.length || 1), icon: BookOpen, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                    { label: 'Verification (NIC)', value: teacher.nic || 'Verified', icon: Award, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                    { label: 'Instructor since', value: formatDate(teacher.createdAt), icon: Calendar, color: 'bg-slate-50 text-slate-500 border-slate-200' },
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
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Instructor Directory Files</h4>
                                        <div className="space-y-6">
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Mail className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Authentication Email</p>
                                                    <p className="text-sm font-semibold text-slate-800">{teacher.email || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Phone className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Verified Phone Line</p>
                                                    <p className="text-sm font-semibold text-slate-800 tracking-tight">{teacher.phone || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><MapPin className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Registered Residence</p>
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
                                                <span className="text-xs font-semibold text-slate-500">Assigned Batches</span>
                                                <span className="text-xs font-black text-primary px-2 bg-primary/5 rounded">{assignedClasses.length} Units</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50 hover:border-primary/20 transition-colors">
                                                <span className="text-xs font-semibold text-slate-500">Current Work Status</span>
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 rounded uppercase tracking-widest border border-emerald-100">Full Access</span>
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
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Academic Responsibility</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{assignedClasses.length} Units</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {assignedClasses.length > 0 ? assignedClasses.map((cls) => (
                                    <div key={cls.id} className="p-5 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all bg-white group flex flex-col justify-between min-h-[140px]">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all flex items-center justify-center">
                                                    <BookOpen className="w-5 h-5" />
                                                </div>
                                                <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-primary transition-colors" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{cls.name}</h5>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{cls.subject} • {cls.grade}</p>
                                            </div>
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

                    {activeTab === 'financials' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Salary Disbursement History</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{recentSalaries.length} Records</span>
                             </div>
                             <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Financial Term</th>
                                            <th className="px-6 py-4">Fulfillment Status</th>
                                            <th className="px-6 py-4 text-right">Settled Amount</th>
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
                                                <td colSpan={3} className="px-6 py-16 text-center text-slate-400 font-medium italic">No financial footprints detected in current ledger.</td>
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
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Verification Compliance</h4>
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
                                                    <p className="text-xs font-bold text-slate-800 leading-none mb-1">Access Protocol</p>
                                                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-widest">Type: Faculty Instructor</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Operational Logs</h4>
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Registered Date</span>
                                                <span className="font-bold text-slate-800">{formatDate(teacher.createdAt)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-500 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Work Status</span>
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

        {/* Global Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-0.5">Faculty Audit Finalized</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-8 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 hover:bg-white transition-all shadow-sm active:scale-95"
                >
                    Dismiss View
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
