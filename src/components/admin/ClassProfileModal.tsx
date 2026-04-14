"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  X, Mail, Phone, MapPin, 
  BookOpen, Clock, Calendar, Activity,
  ArrowUpRight, Loader2, Users, GraduationCap, CreditCard, Layers, History, Hash
} from "lucide-react";
import { Class, Teacher, Student, Subject, Grade } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import { formatTime } from "@/lib/formatters";
import StudentProfileModal from "@/components/admin/StudentProfileModal";

interface ClassProfileModalProps {
  classId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClassProfileModal({ classId, isOpen, onClose }: ClassProfileModalProps) {
  const [classData, setClassData] = useState<Class | null>(null);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'schedule' | 'financials'>('overview');

  // Student Profile View State
  const [isStudentViewOpen, setIsStudentViewOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      // 1. Fetch Class Info
      const classDoc = await getDoc(doc(db, "classes", classId));
      if (!classDoc.exists()) {
        setLoading(false);
        return;
      }
      const cData = { id: classDoc.id, ...classDoc.data() } as Class;
      setClassData(cData);

      // 2. Fetch Teacher Info
      if (cData.teacherId) {
        const tDoc = await getDoc(doc(db, "teachers", cData.teacherId));
        if (tDoc.exists()) {
          setTeacher({ id: tDoc.id, ...tDoc.data() } as Teacher);
        }
      }

      // 3. Fetch Enrolled Students
      const studentQuery = query(
        collection(db, "students"), 
        where("enrolledClasses", "array-contains", classId)
      );
      const studentSnap = await getDocs(studentQuery);
      setStudents(studentSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));

    } catch (error) {
      console.error("Error loading class profile:", error);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const handleStudentView = (id: string) => {
    setSelectedStudentId(id);
    setIsStudentViewOpen(true);
  };

  useEffect(() => {
    if (isOpen && classId) {
      loadData();
    }
  }, [isOpen, classId, loadData]);

  if (!isOpen) return null;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* Header - High Fidelity Terminal Style */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <BookOpen className="w-7 h-7" />}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {loading ? <Skeleton variant="text" width="180px" height="24px" /> : classData?.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" /> {loading ? "..." : classData?.subject}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${classData?.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {loading ? "..." : classData?.status}
                         </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Professional Navigation Bar */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['overview', 'students', 'schedule', 'financials'] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab === 'overview' ? 'Overview' : tab === 'students' ? 'Students' : tab === 'schedule' ? 'Times' : 'Stats'}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
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
            ) : classData && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-10">
                            {/* KPI Board */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {[
                                    { label: 'Enrolled', value: `${students.length} Students`, icon: Users, color: 'bg-primary/5 text-primary border-primary/10' },
                                    { label: 'Grade', value: classData.grade, icon: GraduationCap, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                    { label: 'Monthly Fee', value: `LKR ${classData.monthlyFee?.toLocaleString()}`, icon: CreditCard, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                    { label: 'Completed Cycles', value: Math.floor((classData.completedSessions || 0) / (classData.sessionsPerCycle || 8)), icon: History, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
                                    { label: 'Created', value: formatDate(classData.createdAt), icon: Calendar, color: 'bg-slate-50 text-slate-500 border-slate-200' },
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
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Instructor Assignment</h4>
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-2xl font-bold text-slate-400 shadow-sm">
                                                {teacher?.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-800">{teacher?.name || 'Unassigned'}</p>
                                                <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">Lead {classData.subject} Teacher</p>
                                                <div className="flex items-center gap-4 mt-3">
                                                   <div className="flex items-center gap-1.5">
                                                      <Mail className="w-3 h-3 text-slate-300" />
                                                      <span className="text-[11px] font-medium text-slate-500">{teacher?.email || 'No email'}</span>
                                                   </div>
                                                   <div className="flex items-center gap-1.5">
                                                      <Phone className="w-3 h-3 text-slate-300" />
                                                      <span className="text-[11px] font-medium text-slate-500">{teacher?.phone || 'No phone'}</span>
                                                   </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                   <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Operational Details</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Sessions Per Cycle</span>
                                                <span className="text-xs font-bold text-slate-800">{classData.sessionsPerCycle || 8} Sessions</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Current Cycle Progress</span>
                                                <span className="text-xs font-black text-primary px-2 bg-primary/5 rounded">{classData.sessionsSinceLastPayment || 0} / 8 Pending</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Total Completed</span>
                                                <span className="text-xs font-bold text-slate-800">{classData.completedSessions || 0} Sessions</span>
                                            </div>
                                        </div>
                                   </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'students' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Enrolled Students</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{students.length} Students</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {students.length > 0 ? students.map((std) => (
                                    <div key={std.id} className="p-4 rounded-xl border border-slate-100 hover:border-primary/20 transition-all bg-white group flex items-center justify-between shadow-sm hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-sm font-bold group-hover:bg-primary group-hover:text-white transition-all">
                                                {std.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-sm">{std.name}</h5>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {std.studentId}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleStudentView(std.id)}
                                            className="p-2 rounded-lg hover:bg-slate-50 text-slate-300 hover:text-primary transition-colors"
                                        >
                                            <ArrowUpRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No students enrolled yet</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Session Schedule</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{(classData.schedules || []).length} Slots</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(classData.schedules || []).map((slot, idx) => (
                                    <div key={idx} className="p-5 rounded-2xl border border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-primary shadow-sm">
                                                <Clock className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-base capitalize">{slot.dayOfWeek}</h5>
                                                <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-widest">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] mb-1 leading-none">Hall / Room</p>
                                            <p className="text-sm font-black text-slate-600">{slot.room || 'TBD'}</p>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-6">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Revenue Insights</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-500">Est. Monthly Revenue</span>
                                            <span className="text-lg font-bold text-slate-800">LKR {(classData.monthlyFee * students.length).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-slate-500">Active Students</span>
                                            <span className="font-bold text-slate-800">{students.length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-slate-500">Fee Per Student</span>
                                            <span className="font-bold text-slate-800">LKR {classData.monthlyFee?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-slate-200/50">
                                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                                            <History className="w-4 h-4 text-amber-600 mt-0.5" />
                                            <p className="text-[10px] font-medium text-amber-700 leading-relaxed italic">Revenue shown is a gross estimate based on current enrollment and standard fee. Individual scholarship adjustments not factored here.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col justify-center items-center text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                                        <History className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-slate-800">Operational Summary</h4>
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-2 justify-center">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Sessions:</span>
                                                <span className="text-sm font-bold text-slate-800">{classData.completedSessions || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-2 justify-center">
                                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Cycles:</span>
                                                <span className="text-sm font-bold text-slate-800">{Math.floor((classData.completedSessions || 0) / (classData.sessionsPerCycle || 8))}</span>
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
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-0.5 leading-none">Note: Details verified</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-8 py-2.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg border border-slate-200 hover:bg-white transition-all shadow-sm active:scale-95"
                >
                    Close
                </button>
            </div>
        </div>
      </div>

      <StudentProfileModal 
        isOpen={isStudentViewOpen}
        onClose={() => {
            setIsStudentViewOpen(false);
            setSelectedStudentId(null);
        }}
        studentId={selectedStudentId || ""}
      />
    </div>
  );
}
