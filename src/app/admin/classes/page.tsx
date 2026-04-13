"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, writeBatch, increment, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, BookOpen, Clock, Calendar, Edit, Trash2, Ban, CheckCircle, Filter, X, MapPin, Projector, History, ArrowRight } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Class, Teacher, Subject, Grade } from "@/types/models";
import ClassModal from "@/components/admin/ClassModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";
import { formatTime } from "@/lib/formatters";

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [teachers, setTeachers] = useState<Record<string, Teacher>>({});
  const [subjects, setSubjects] = useState<Record<string, Subject>>({});
  const [grades, setGrades] = useState<Record<string, Grade>>({});

  const loadClasses = async () => {
    setLoading(true);
    try {
      const [classSnap, teacherSnap, subjectSnap, gradeSnap] = await Promise.all([
        getDocs(query(collection(db, "classes"), orderBy("name", "asc"))),
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "subjects")),
        getDocs(collection(db, "grades"))
      ]);

      const teacherMap: Record<string, Teacher> = {};
      teacherSnap.docs.forEach(d => teacherMap[d.id] = { id: d.id, ...d.data() } as Teacher);
      setTeachers(teacherMap);

      const subjectMap: Record<string, Subject> = {};
      subjectSnap.docs.forEach(d => subjectMap[d.id] = { id: d.id, ...d.data() } as Subject);
      setSubjects(subjectMap);

      const gradeMap: Record<string, Grade> = {};
      gradeSnap.docs.forEach(d => gradeMap[d.id] = { id: d.id, ...d.data() } as Grade);
      setGrades(gradeMap);

      setClasses(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    } catch (error) {
      console.error("Error loading registry", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const toggleStatus = async (item: Class) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, "classes", item.id), { status: newStatus });
      toast.success(newStatus === 'active' ? "Class session restored." : "Class session suspended.");
      loadClasses();
    } catch {
      toast.error("Process failed.");
    }
  };

  const handleEdit = (item: Class) => {
    setSelectedClass(item);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
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
        if (cls && cls.gradeId && grades[cls.gradeId]) {
          batch.update(doc(db, "grades", cls.gradeId), { classCount: increment(-1) });
        }

        // Auto-Sync: Remove this class from all students' enrollment lists
        const studentQuery = query(collection(db, "students"), where("enrolledClasses", "array-contains", classToDelete));
        const studentsInClass = await getDocs(studentQuery);
        
        studentsInClass.docs.forEach((stdDoc, index) => {
          if (index < 490) { // Safety limit for batch operations
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
        loadClasses();
    } catch (error) {
        console.error("Error deleting class:", error);
        toast.error("Process failed.");
    } finally {
        setDeleting(false);
    }
  };

  const filteredClasses = classes.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         c.teacherName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGrade = filterGrade === "" || c.gradeId === filterGrade;
    const matchesSubject = filterSubject === "" || c.subjectId === filterSubject;
    
    // Check if any schedule matches the selected day
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

  const statCards = [
    { title: "Total Classes", value: classes.length, icon: Projector, color: "text-blue-500" },
    { title: "Active Sessions", value: classes.filter(c => c.status === 'active').length, icon: CheckCircle, color: "text-emerald-500" },
    { title: "Suspended", value: classes.filter(c => c.status === 'inactive').length, icon: Ban, color: "text-rose-500" },
    { title: "Total Delivered", value: classes.reduce((sum, c) => sum + (c.completedSessions || 0), 0), icon: History, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Class List</h1>
            <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
              View and manage all classes
            </p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Create Class
        </button>
      </div>

      {/* 🏛️ Specialized Stats Header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4">
        {loading ? (
            [1, 2, 3, 4].map(idx => (
                <Skeleton key={idx} variant="rect" width="100%" height="80px" className="rounded-2xl" />
            ))
        ) : statCards.map((card, idx) => (
          <div 
            key={idx} 
            className={`bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-200 hover:border-primary/30 group shadow-sm`}
          >
            <div className="flex flex-col gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color.replace('text-', 'bg-').split('-').slice(0, 2).join('-')}-50 ${card.color} transition-all shadow-sm`}>
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{card.title}</p>
                <div className="flex items-center gap-1">
                  <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary transition-colors">{card.value}</p>
                  <ArrowRight className="w-2.5 h-2.5 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ClassModal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setSelectedClass(null);
        }} 
        onSuccess={loadClasses}
        initialData={selectedClass}
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
        message="Terminating this class will permanently remove its weekly schedule, room assignment, and link to the instructor. Student enrollment counts will be reset, although individual records will persist."
      />

      <div className="bg-white/70 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-xl shadow-slate-100/30">
        <div className="relative w-full sm:max-w-md group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search classes, teachers or subjects..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.1em] focus:ring-4 focus:ring-primary/5 transition-all shadow-inner placeholder:text-slate-300"
          />
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`w-12 h-12 flex items-center justify-center border rounded-2xl transition-all ${showFilters ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-primary shadow-sm'}`}
           >
            <Filter className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Enhanced Filter Panel */}
      {showFilters && (
        <div className="p-8 rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-100/20 grid grid-cols-1 sm:grid-cols-5 gap-6 animate-in slide-in-from-top-4 duration-500">
           <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Grade</label>
              <select 
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/5 transition-all outline-none"
              >
                <option value="">All Levels</option>
                {Object.values(grades).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Subject</label>
              <select 
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/5 transition-all outline-none"
              >
                <option value="">All Subjects</option>
                {Object.values(subjects).map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Session Day</label>
              <select 
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/5 transition-all outline-none"
              >
                <option value="">All Days</option>
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase tracking-wider focus:ring-4 focus:ring-primary/5 transition-all outline-none"
              >
                <option value="">All States</option>
                <option value="active">Operational</option>
                <option value="inactive">Suspended</option>
              </select>
           </div>
           <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="w-full h-[46px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Clear
              </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-5 space-y-4 shadow-sm animate-pulse">
              <div className="flex justify-between items-start mb-4">
                <Skeleton variant="rect" width="40px" height="40px" className="rounded-xl" />
                <Skeleton variant="rect" width="60px" height="20px" className="rounded-md" />
              </div>
              <Skeleton variant="text" width="80%" height="20px" />
              <Skeleton variant="text" width="60%" height="14px" />
              <div className="space-y-3 mt-6 pt-4 border-t border-slate-50">
                <Skeleton variant="text" width="100%" height="12px" />
                <Skeleton variant="text" width="100%" height="12px" />
                <Skeleton variant="text" width="100%" height="12px" />
              </div>
              <div className="flex gap-2 mt-6">
                <Skeleton variant="rect" width="100%" height="32px" className="rounded-lg" />
                <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
              </div>
            </div>
          ))
        ) : filteredClasses.length > 0 ? filteredClasses.map((item) => {
          const teacher = teachers[item.teacherId];
          const subject = subjects[item.subjectId];
          const grade = grades[item.gradeId];

          const isClassInactive = item.status === 'inactive';

          const sessionsGoal = 8;
          const sessionsPending = item.sessionsSinceLastPayment || 0;
          const sessionsDone = item.completedSessions || 0;
          const progressPercent = Math.min((sessionsPending / sessionsGoal) * 100, 100);

          return (
            <div key={item.id} className={`bg-white rounded-2xl border border-slate-200/60 transition-all duration-200 hover:border-primary/30 flex flex-col group relative overflow-hidden ${isClassInactive ? 'grayscale-[0.5] opacity-80' : ''}`}>
              
              <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary`}>
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{item.subject || subject?.name || '---'}</p>
                            <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-none group-hover:text-primary transition-colors">{item.name}</h3>
                        </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isClassInactive ? 'bg-slate-50 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
                      {isClassInactive ? 'Inactive' : 'Active'}
                    </span>
                </div>

                {/* Ledger Insights */}
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">Ledger Progress</p>
                        <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                            <span className={sessionsPending >= 8 ? 'text-primary' : 'text-slate-600'}>{sessionsPending}</span> 
                            <span className="text-slate-300 font-medium">/ 8 Pending</span>
                        </p>
                    </div>
                    <div className="w-16 h-1.5 bg-white rounded-full overflow-hidden border border-slate-100">
                        <div 
                            className={`h-full transition-all duration-1000 ease-out ${sessionsPending >= 8 ? 'bg-primary' : 'bg-slate-300'}`} 
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>

                <div className="space-y-3.5">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all">
                            {item.teacherName?.charAt(0)}
                         </div>
                         <p className="text-xs font-semibold text-slate-500">{item.teacherName || 'No Faculty'}</p>
                      </div>
                      <p className="text-xs font-bold text-primary">{item.studentCount || 0} Students</p>
                   </div>
                   
                   <div className="space-y-2 pt-1">
                      {(item.schedules || []).map((schedule, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">
                           <span className="font-black uppercase tracking-widest">{schedule.dayOfWeek}</span>
                           <span className="font-medium">{formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}</span>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="mt-auto p-4 bg-slate-50/30 border-t border-slate-100 flex gap-2">
                <button 
                  onClick={() => toggleStatus(item)}
                  title={isClassInactive ? 'Restore session' : 'Suspend session'}
                  className={`flex-1 flex items-center justify-center py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isClassInactive ? 'bg-slate-900 text-white hover:bg-black' : 'bg-white border border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-100 hover:bg-amber-50'}`}
                >
                   {isClassInactive ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={() => handleEdit(item)}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/20 rounded-lg transition-all"
                >
                    <Edit className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => confirmDelete(item.id)}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 rounded-lg transition-all"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500 font-medium">No classes found matching your criteria.</p>
            {(searchTerm || filterGrade || filterSubject || filterDay || filterStatus) && (
              <button onClick={clearFilters} className="mt-4 text-sm font-black uppercase tracking-widest text-primary hover:underline">Clear all filters</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
