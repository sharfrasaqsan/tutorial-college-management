"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen, Users, Calendar, Clock, MapPin, Activity, Plus, Edit, Trash2, Ban, CheckCircle, Filter, X, Search, History as HistoryIcon } from "lucide-react";
import { Class, Grade, Subject } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import ClassModal from "@/components/admin/ClassModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Skeleton from "@/components/ui/Skeleton";
import toast from "react-hot-toast";

export default function MyClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [subjects, setSubjects] = useState<Record<string, Subject>>({});

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTeacherClasses = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const classQ = query(collection(db, "classes"), where("teacherId", "==", user.uid));
      const [gradeSnap, subjectSnap, classSnap] = await Promise.all([
        getDocs(collection(db, "grades")),
        getDocs(collection(db, "subjects")),
        getDocs(classQ)
      ]);
      
      const gradeMap: Record<string, Grade> = {};
      gradeSnap.docs.forEach(d => gradeMap[d.id] = { id: d.id, ...d.data() } as Grade);
      setGrades(gradeMap);

      const subjectMap: Record<string, Subject> = {};
      subjectSnap.docs.forEach(d => subjectMap[d.id] = { id: d.id, ...d.data() } as Subject);
      setSubjects(subjectMap);

      setClasses(classSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Class)));
    } catch (error) {
      console.error("Error loading teacher classes", error);
      toast.error("Failed to load classes.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeacherClasses();
  }, [loadTeacherClasses]);

  const handleAdd = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Class) => {
    setSelectedClass(item);
    setIsModalOpen(true);
  };

  const toggleStatus = async (item: Class) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, "classes", item.id), { status: newStatus });
      toast.success(newStatus === 'active' ? "Class session restored." : "Class session suspended.");
      loadTeacherClasses();
    } catch {
      toast.error("Process failed.");
    }
  };

  const confirmDelete = (id: string) => {
    setClassToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!classToDelete) return;
    setDeleting(true);
    const batch = writeBatch(db);
    try {
      const cls = classes.find(c => c.id === classToDelete);
      if (cls && cls.gradeId) {
        batch.update(doc(db, "grades", cls.gradeId), { classCount: increment(-1) });
      }

      const studentQuery = query(collection(db, "students"), where("enrolledClasses", "array-contains", classToDelete));
      const studentsInClass = await getDocs(studentQuery);
      
      studentsInClass.docs.forEach((stdDoc, index) => {
        if (index < 490) { 
          batch.update(doc(db, "students", stdDoc.id), { 
            enrolledClasses: (stdDoc.data().enrolledClasses || []).filter((id: string) => id !== classToDelete) 
          });
        }
      });

      batch.delete(doc(db, "classes", classToDelete));
      await batch.commit();

      toast.success("Class schedule dissolved.");
      setIsDeleteOpen(false);
      setClassToDelete(null);
      loadTeacherClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Process failed.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredClasses = classes.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGrade = filterGrade === "" || c.gradeId === filterGrade;
    const matchesSubject = filterSubject === "" || c.subjectId === filterSubject;
    const matchesDay = filterDay === "" || c.schedules?.some(s => s.dayOfWeek.toLowerCase() === filterDay.toLowerCase());
    const matchesStatus = filterStatus === "" || c.status === filterStatus;
    
    return matchesSearch && matchesGrade && matchesSubject && matchesDay && matchesStatus;
  });

  const clearFilters = () => {
    setFilterGrade("");
    setFilterSubject("");
    setFilterDay("");
    setFilterStatus("");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <BookOpen className="w-7 h-7 text-indigo-600" /> Academic Portfolio
            </h2>
            <p className="text-slate-500 text-sm font-bold tracking-tight">Manage your scheduled sessions and monitor batch progress.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
            <button 
                onClick={handleAdd}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" /> Schedule Class
            </button>
        </div>
      </div>

      <ClassModal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setSelectedClass(null);
        }} 
        onSuccess={loadTeacherClasses}
        initialData={selectedClass}
        fixedTeacherId={user?.uid}
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => {
            setIsDeleteOpen(false);
            setClassToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Dissolve Class Session"
        message="Terminating this class will permanently remove its weekly schedule and enrollment data. This action cannot be undone."
      />

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Search your classes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex-1 sm:flex-none px-4 py-2 border rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
           >
            <Filter className="w-4 h-4" /> Filters
            {(filterGrade || filterSubject || filterDay || filterStatus) && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
            )}
           </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-xl shadow-indigo-50/20 grid grid-cols-1 sm:grid-cols-5 gap-4 animate-in slide-in-from-top duration-300">
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Grade</label>
              <select 
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">All Grades</option>
                {Object.values(grades).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subject</label>
              <select 
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">All Subjects</option>
                {Object.values(subjects).map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Day</label>
              <select 
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">All Days</option>
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
           </div>
           <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="w-full h-[38px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Reset
              </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <Skeleton variant="rect" width="48px" height="48px" className="rounded-2xl" />
                <Skeleton variant="rect" width="60px" height="24px" className="rounded-md" />
              </div>
              <Skeleton variant="text" width="80%" height="24px" />
              <div className="space-y-3 mt-6 pt-4 border-t border-slate-50">
                <Skeleton variant="text" width="100%" height="40px" className="rounded-xl" />
              </div>
            </div>
          ))
        ) : filteredClasses.length > 0 ? filteredClasses.map((item) => {
          const isClassInactive = item.status === 'inactive';
          return (
            <div key={item.id} className={`bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/30 transition-all group overflow-hidden ${isClassInactive ? 'opacity-70 grayscale-[0.2]' : ''}`}>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 ${isClassInactive ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <BookOpen className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${isClassInactive ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {isClassInactive ? 'Suspended' : 'Active'}
                            </span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className={`text-lg font-black mb-1 transition-colors ${isClassInactive ? 'text-slate-500' : 'text-slate-800'}`}>{item.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span>{item.subject}</span>
                            <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                            <span className="text-indigo-500">{item.grade} Batch</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                          <Users className="w-4 h-4 text-slate-400" />
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Students</p>
                              <p className="text-xs font-bold text-slate-700">{item.studentCount || 0}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                          <Activity className="w-4 h-4 text-emerald-500" />
                          <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Status</p>
                              <p className="text-xs font-bold text-slate-700">Live</p>
                          </div>
                      </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                           <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" /> Weekly Schedule
                           </p>
                        </div>
                        <div className="space-y-2">
                        {item.schedules?.map((schedule, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/30 border border-slate-100/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                    <span className="text-[11px] font-bold text-slate-700 capitalize">{schedule.dayOfWeek}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                        {schedule.startTime} - {schedule.endTime}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                                        <MapPin className="w-3 h-3 child" />
                                        {schedule.room || 'Hall'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>

                    <div className="flex gap-2 pt-6 border-t border-slate-50">
                        {!isClassInactive && (
                            <Link 
                                href="/teacher/attendance"
                                className="flex-1 bg-slate-900 text-white rounded-xl py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-indigo-100/50"
                            >
                                <HistoryIcon className="w-3.5 h-3.5" /> View Ledger
                            </Link>
                        )}
                        <button 
                            onClick={() => toggleStatus(item)}
                            title={isClassInactive ? "Restore Session" : "Suspend Session"}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isClassInactive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                        >
                            {isClassInactive ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                        <button 
                            onClick={() => handleEdit(item)}
                            className="w-11 h-11 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => confirmDelete(item.id)}
                            className="w-11 h-11 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
            <BookOpen className="w-12 h-12 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-500 font-bold tracking-tight mb-2">No matching classes found.</p>
            {(searchTerm || filterGrade || filterSubject || filterDay || filterStatus) ? (
              <button onClick={clearFilters} className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:underline">Clear all filters</button>
            ) : (
              <button 
                  onClick={handleAdd}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                  <Plus className="w-3 h-3" /> Schedule First Class
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
