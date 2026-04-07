"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpen, Users, Calendar, Clock, MapPin, Activity, ClipboardCheck, Plus, Edit, Trash2, Ban, CheckCircle } from "lucide-react";
import { Class, Grade } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import ClassModal from "@/components/admin/ClassModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";

export default function MyClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [grades, setGrades] = useState<Record<string, Grade>>({});

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTeacherClasses = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const classQ = query(collection(db, "classes"), where("teacherId", "==", user.uid));
      const gradeSnap = await getDocs(collection(db, "grades"));
      
      const gradeMap: Record<string, Grade> = {};
      gradeSnap.docs.forEach(d => gradeMap[d.id] = { id: d.id, ...d.data() } as Grade);
      setGrades(gradeMap);

      const snap = await getDocs(classQ);
      setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    } catch (error) {
      console.error("Error loading teacher classes", error);
      toast.error("Failed to load classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherClasses();
  }, [user]);

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
      loadTeacherClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Process failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-indigo-600" /> Academic Portfolio
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">Manage your scheduled sessions, track batch progress, and initiate attendance logging for your assigned students.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest">Active ({classes.length} Session{classes.length === 1 ? '' : 's'})</div>
                <div className="px-4 py-2 text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest cursor-not-allowed">Archived (0)</div>
            </div>
            <button 
                onClick={handleAdd}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
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
        message="Terminating this class will permanently remove its weekly schedule, room assignment, and link to the instructor. Student enrollment counts will be reset, although individual records will persist."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-white rounded-3xl animate-pulse"></div>)
        ) : classes.length > 0 ? classes.map((item) => {
          const isClassInactive = item.status === 'inactive';
          return (
            <div key={item.id} className={`bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/40 transition-all group overflow-hidden border-b-4 border-b-transparent hover:border-b-indigo-600 ${isClassInactive ? 'opacity-75 grayscale-[0.2]' : ''}`}>
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-500 ${isClassInactive ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                            <BookOpen className="w-8 h-8" />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isClassInactive ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                {isClassInactive ? 'Suspended' : 'Active'}
                            </span>
                            {!isClassInactive && (
                                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-tighter">
                                    <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Status
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mb-8">
                        <h3 className={`text-2xl font-black mb-1 transition-colors ${isClassInactive ? 'text-slate-500' : 'text-slate-800 group-hover:text-indigo-600'}`}>{item.name}</h3>
                        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                            <span>{item.subject}</span>
                            <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                            <span className="text-indigo-500">{item.grade} Batch</span>
                        </div>
                    </div>

                    <div className="space-y-3 mb-8 pt-6 border-t border-slate-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Students</p>
                                    <p className="text-sm font-bold text-slate-700">
                                    {item.studentCount || 0} Student{item.studentCount === 1 ? '' : 's'} registered
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Weekly Schedule</p>
                            {item.schedules?.map((schedule, idx) => (
                                <div key={idx} className="grid grid-cols-2 gap-4 p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                                    <div className="flex items-center gap-2.5">
                                        <Calendar className="w-4 h-4 text-indigo-500" />
                                        <span className="text-xs font-bold text-slate-700 capitalize">{schedule.dayOfWeek}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <Clock className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-bold text-slate-700">{schedule.startTime} - {schedule.endTime}</span>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2.5 pt-1 border-t border-slate-100/50">
                                        <MapPin className="w-4 h-4 text-amber-500" />
                                        <span className="text-[11px] font-medium text-slate-500">{schedule.room || 'Main Hall'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {!isClassInactive && (
                            <Link 
                                href={`/teacher/attendance/mark?classId=${item.id}`}
                                className="flex-1 bg-slate-900 text-white rounded-2xl py-4 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100/50"
                            >
                                <ClipboardCheck className="w-4 h-4" /> Log Attendance
                            </Link>
                        )}
                        <div className="flex gap-2">
                            <button 
                                onClick={() => toggleStatus(item)}
                                title={isClassInactive ? "Restore Session" : "Suspend Session"}
                                className={`w-12 h-14 rounded-2xl flex items-center justify-center transition-all ${isClassInactive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                            >
                                {isClassInactive ? <CheckCircle className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                            </button>
                            <button 
                                onClick={() => handleEdit(item)}
                                className="w-12 h-14 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                                <Edit className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => confirmDelete(item.id)}
                                className="w-12 h-14 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-40 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
            <BookOpen className="w-16 h-16 text-slate-100 mx-auto mb-6" />
            <p className="text-slate-500 font-bold tracking-tight text-xl mb-2">No assigned classes found.</p>
            <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">You haven't scheduled any classes yet. Click the button above to create your first session.</p>
            <button 
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
                <Plus className="w-4 h-4" /> Schedule Your First Class
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
