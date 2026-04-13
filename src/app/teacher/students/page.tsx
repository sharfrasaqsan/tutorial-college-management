"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, Search, BookOpen, Edit } from "lucide-react";
import { Student, Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import StudentModal from "@/components/admin/StudentModal";
import StudentProfileModal from "@/components/admin/StudentProfileModal";
import Skeleton from "@/components/ui/Skeleton";
import toast from "react-hot-toast";

export default function MyStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      // 1. Fetch Teacher's Classes
      const classesSnap = await getDocs(query(collection(db, "classes"), where("teacherId", "==", user.uid)));
      const teacherClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(teacherClasses);
      
      if (teacherClasses.length > 0 && !activeTab) {
        setActiveTab(teacherClasses[0].id);
      }

      const classIds = teacherClasses.map(c => c.id);

      if (classIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // 2. Fetch Students enrolled in ANY of these classes
      const chunks = [];
      for (let i = 0; i < classIds.length; i += 30) {
        chunks.push(classIds.slice(i, i + 30));
      }

      const studentPromises = chunks.map(chunk => 
        getDocs(query(collection(db, "students"), where("enrolledClasses", "array-contains-any", chunk)))
      );

      const studentSnaps = await Promise.all(studentPromises);
      const studentMap = new Map<string, Student>();
      
      studentSnaps.forEach(snap => {
        snap.docs.forEach(doc => {
          studentMap.set(doc.id, { id: doc.id, ...doc.data() } as Student);
        });
      });

      setStudents(Array.from(studentMap.values()));
    } catch (error) {
      console.error("Error loading student data", error);
      toast.error("Failed to load student directory.");
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openStudentDetails = (student: Student, mode: 'view' | 'edit' = 'view') => {
    setSelectedStudent(student);
    if (mode === 'view') {
        setIsProfileOpen(true);
    } else {
        setIsModalOpen(true);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.studentId?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const currentClass = classes.find(c => c.id === activeTab);
  const classStudents = currentClass ? filteredStudents.filter(s => s.enrolledClasses?.includes(currentClass.id)) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* 🏛️ Page Header - Dashboard Style Parity */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Students
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider leading-none">
            List of your students
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Class Selection Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm min-w-[200px]">
            <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Class</span>
            </div>
            <select
                value={activeTab || ""}
                onChange={(e) => setActiveTab(e.target.value)}
                className="bg-transparent flex-1 px-4 py-1.5 text-sm font-black text-slate-700 outline-none cursor-pointer hover:text-indigo-600 transition-colors uppercase tracking-tight"
            >
                {[...classes]
                  .sort((a, b) => (a.grade || "").localeCompare(b.grade || "", undefined, { numeric: true }))
                  .map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
                {classes.length === 0 && <option value="">No Classes Assigned</option>}
            </select>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden outline outline-1 outline-slate-50 min-h-[450px]">
          {loading ? (
              <div className="space-y-4 p-8">
                {[1, 2, 3, 4, 5].map(j => <Skeleton key={j} width="100%" height="68px" className="rounded-2xl" />)}
              </div>
          ) : activeTab && currentClass ? (
            <div className="overflow-x-auto animate-in fade-in slide-in-from-right-4 duration-500">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Student</th>
                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">ID</th>
                            <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">Grade & Status</th>
                            <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-wider text-slate-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {classStudents.length > 0 ? classStudents.map((s) => (
                            <tr key={s.id} className="hover:bg-indigo-50/10 transition-colors group">
                                <td className="px-8 py-5">
                                    <button 
                                        onClick={() => openStudentDetails(s, 'view')}
                                        className="flex items-center gap-4 text-left group-hover:translate-x-1 transition-transform"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                            {s.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{s.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{s.phone || s.parentPhone}</p>
                                        </div>
                                    </button>
                                </td>
                                <td className="px-8 py-5 text-xs font-black text-slate-500 tracking-tight">
                                    {s.studentId || 'NO_ID'}
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500">{s.grade}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                            <span className="text-[10px] font-bold text-slate-500 capitalize">{s.status}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => openStudentDetails(s, 'edit')}
                                        className="w-10 h-10 items-center justify-center flex bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                                        title="Quick Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openStudentDetails(s, 'view')}
                                        className="px-5 py-2.5 bg-slate-900 text-white rounded-[0.9rem] text-[10px] font-black uppercase tracking-wider hover:bg-indigo-600 transition-all shadow-md shadow-indigo-100/50"
                                    >
                                        View Profile
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center flex flex-col items-center justify-center">
                                    <Users className="w-12 h-12 text-slate-100 mb-4" />
                                    <p className="text-slate-500 font-bold tracking-tight">No students found.</p>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Class: {currentClass.name}</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[450px] text-center px-10">
                <BookOpen className="w-20 h-20 text-slate-100 mb-6" />
                <h4 className="text-lg font-black text-slate-700 mb-2">No Classes</h4>
                <p className="text-sm text-slate-400 max-w-xs font-medium">You don&apos;t have any assigned classes at this time.</p>
            </div>
          )}
      </div>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }} 
        onSuccess={loadData}
        initialData={selectedStudent}
        isReadOnly={false}
        teacherId={user?.uid}
      />

      <StudentProfileModal 
        isOpen={isProfileOpen}
        onClose={() => {
            setIsProfileOpen(false);
            setSelectedStudent(null);
        }}
        studentId={selectedStudent?.id || ""}
      />
    </div>
  );
}
