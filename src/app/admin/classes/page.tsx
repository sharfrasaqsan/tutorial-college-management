"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, deleteDoc, updateDoc, writeBatch, increment, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, BookOpen, Clock, Users, Calendar, Edit, Trash2, Ban, CheckCircle, AlertCircle, Filter, X } from "lucide-react";
import { Class, Teacher, Subject, Grade } from "@/types/models";
import ClassModal from "@/components/admin/ClassModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";

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
        if (cls && cls.gradeId) {
          batch.update(doc(db, "grades", cls.gradeId), { classCount: increment(-1) });
        }

        // Auto-Sync: Remove this class from all students' enrollment lists
        const studentQuery = query(collection(db, "students"), where("enrolledClasses", "array-contains", classToDelete));
        const studentsInClass = await getDocs(studentQuery);
        
        studentsInClass.docs.forEach((stdDoc, index) => {
          if (index < 490) { // Safety limit for batch operations
            const stdData = stdDoc.data();
            const newClasses = (stdData.enrolledClasses || []).filter((id: string) => id !== classToDelete);
            batch.update(doc(db, "students", stdDoc.id), { enrolledClasses: newClasses });
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
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = filterGrade === "" || c.gradeId === filterGrade;
    const matchesSubject = filterSubject === "" || c.subjectId === filterSubject;
    const matchesDay = filterDay === "" || c.dayOfWeek === filterDay;
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Class Management</h2>
          <p className="text-sm text-slate-500">Monitor and schedule academic sessions.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Create Class
        </button>
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

      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
        <div className="relative w-full sm:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor font-medium">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Search classes or subjects..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
           <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
           >
            <Filter className="w-4 h-4" /> Filters
            {(filterGrade || filterSubject || filterDay || filterStatus) && (
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            )}
           </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-4 animate-in slide-in-from-top duration-300">
           <div className="space-y-1">
              <label className="text-[10px] font-black   uppercase text-slate-400 ml-1">Grade</label>
              <select 
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Grades</option>
                {Object.values(grades).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subject</label>
              <select 
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Subjects</option>
                {Object.values(subjects).map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Day</label>
              <select 
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Days</option>
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
           </div>
           <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="w-full h-[38px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Clear All
              </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4 animate-pulse">
              <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
              <div className="h-6 bg-slate-100 rounded w-2/3"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              <div className="pt-4 border-t border-slate-100 flex justify-between">
                <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              </div>
            </div>
          ))
        ) : filteredClasses.length > 0 ? filteredClasses.map((item) => {
          const teacher = teachers[item.teacherId];
          const subject = subjects[item.subjectId];
          const grade = grades[item.gradeId];

          const isTeacherInactive = teacher?.status === 'inactive';
          const isSubjectInactive = subject?.status === 'inactive';
          const isGradeInactive = grade?.status === 'inactive';
          const isClassInactive = item.status === 'inactive';

          return (
            <div key={item.id} className={`bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-6 flex flex-col group ${isClassInactive ? 'opacity-70 grayscale-[0.3]' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isClassInactive ? 'bg-slate-100 text-slate-400' : 'bg-primary/10 text-primary'}`}>
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-black tracking-widest ${isClassInactive ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'}`}>
                      {isClassInactive ? 'Suspended' : 'Active'}
                    </span>
                    {(isTeacherInactive || isSubjectInactive || isGradeInactive) && !isClassInactive && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-md border border-amber-100 animate-pulse">
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-[9px] font-black uppercase">Dependency Offline</span>
                        </div>
                    )}
                </div>
              </div>
              
              <h3 className={`font-bold text-lg mb-1 transition-colors ${isClassInactive ? 'text-slate-400' : 'text-slate-800'}`}>{item.name}</h3>
              <p className="text-xs text-slate-500 mb-4">{item.subject || subject?.name || '---'} • {item.grade || grade?.name || '---'}</p>
              
              <div className="space-y-3 mt-auto">
                <div className="flex items-center gap-2 text-sm">
                  <Users className={`w-4 h-4 ${isClassInactive ? 'text-slate-300' : 'text-slate-400'}`} />
                  <span className={isClassInactive ? 'text-slate-400' : 'text-slate-600'}>{item.studentCount || 0} Students</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className={`w-4 h-4 ${isClassInactive ? 'text-slate-300' : 'text-slate-400'}`} />
                  <span className={`${isClassInactive ? 'text-slate-400' : 'text-slate-600'} capitalize`}>{item.dayOfWeek}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className={`w-4 h-4 ${isClassInactive ? 'text-slate-300' : 'text-slate-400'}`} />
                  <span className={isClassInactive ? 'text-slate-400' : 'text-slate-600'}>{item.startTime} - {item.endTime}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
                <button 
                  onClick={() => toggleStatus(item)}
                  title={isClassInactive ? "Restore Session" : "Suspend Session"}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isClassInactive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                >
                   {isClassInactive ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                   {isClassInactive ? 'Restore' : 'Suspend'}
                </button>
                <div className="flex gap-1">
                    <button 
                        onClick={() => handleEdit(item)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => confirmDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
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
