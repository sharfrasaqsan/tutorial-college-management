"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Search, Filter, Edit, Eye, Trash2, Ban, CheckCircle, X, Users, CreditCard, Briefcase, ArrowRight, Projector, AlertTriangle, History } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Teacher, Subject } from "@/types/models";
import Link from "next/link";
import TeacherModal from "@/components/admin/TeacherModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import NextImage from "next/image";
import toast from "react-hot-toast";
import { useTeacherProfile } from "@/context/TeacherProfileContext";
import { useDashboard } from "@/hooks/useDashboard";
import { format } from "date-fns";

export default function TeachersPage() {
  const { openTeacherProfile } = useTeacherProfile();
  const { stats, isLoading: statsLoading } = useDashboard();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "teachers"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setTeachers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    } catch (error) {
      console.error("Error loading teachers", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      const subjectSnap = await getDocs(query(collection(db, "subjects"), orderBy("name", "asc")));
      setSubjects(subjectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    } catch (error) {
      console.error("Error loading subjects data", error);
    }
  }

  useEffect(() => {
    loadTeachers();
    loadInitialData();
  }, []);

  const handleEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedTeacher(null);
    setIsModalOpen(true);
  };

  const toggleStatus = async (teacher: Teacher) => {
    try {
      const newStatus = teacher.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, "teachers", teacher.id), { status: newStatus });
      await updateDoc(doc(db, "users", teacher.id), { status: newStatus });
      toast.success(newStatus === 'active' ? "Faculty member active." : "Faculty member suspended.");
      loadTeachers();
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const confirmDelete = (id: string) => {
    setTeacherToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!teacherToDelete) return;
    setDeleting(true);
    try {
        const batch = writeBatch(db);
        
        // Auto-Deactivate associated classes
        const classQuery = query(collection(db, "classes"), where("teacherId", "==", teacherToDelete));
        const classSnap = await getDocs(classQuery);
        classSnap.docs.forEach(cdoc => {
          batch.update(doc(db, "classes", cdoc.id), { status: 'inactive' });
        });

        batch.delete(doc(db, "teachers", teacherToDelete));
        batch.delete(doc(db, "users", teacherToDelete));
        
        await batch.commit();
        toast.success("Faculty records purged. Linked classes suspended.");
        setIsDeleteOpen(false);
        setTeacherToDelete(null);
        loadTeachers();
    } catch (error) {
        console.error("Error deleting teacher:", error);
        toast.error("Process failed.");
    } finally {
        setDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterStatus("");
    setFilterSubject("");
    setSearchTerm("");
  };

  const filteredTeachers = teachers.filter(t => {
    const matchesSearch = 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (t.teacherId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.subjects?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // We check if the filter is empty, or if the teacher has any subject matching the filter (subject name check here, since subjects in teacher model are arrays of names, or arrays of IDs depending on implementation; assuming names for now given original search logic `t.subjects?.some(s => s...toLowerCase())`)
    const matchesSubject = filterSubject === "" || (t.subjects && t.subjects.includes(filterSubject));
    const matchesStatus = filterStatus === "" || t.status === filterStatus;
    
    return matchesSearch && matchesSubject && matchesStatus;
  });

  const statCards = [
    { title: "Total Faculty", value: teachers.length, icon: Briefcase, color: "text-blue-500" },
    { title: "Active Instructors", value: teachers.filter(t => t.status === 'active').length, icon: CheckCircle, color: "text-emerald-500" },
    { title: "Suspended Faculty", value: teachers.filter(t => t.status === 'inactive').length, icon: Ban, color: "text-rose-500" },
    { title: "Pending Settlements", value: stats?.pendingSalariesCount || 0, icon: History, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teacher List</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
            View and manage all teachers
          </p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add Teacher
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

      <TeacherModal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setSelectedTeacher(null);
        }} 
        onSuccess={loadTeachers}
        initialData={selectedTeacher}
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => {
            setIsDeleteOpen(false);
            setTeacherToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Revoke Faculty Access"
        message="De-registering this teacher will permanently terminate their system access and remove their profile from the faculty directory. All linked class associations will remain but will require a new instructor assignment."
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or subject..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" /> Filters
            {(filterSubject || filterStatus) && (
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top duration-300">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subject Expertise</label>
                <select 
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(sub => (
                    // We use sub.name as value because the original UI shows teacher.subjects as an array of names or IDs, and we assume names here.
                    <option key={sub.id} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
             </div>
             <div className="space-y-1 flex flex-col">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account Status</label>
                <div className="flex gap-2">
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Suspended</option>
                  </select>
                  <button 
                    onClick={clearFilters}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    title="Clear All Filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
             </div>
          </div>
        )}
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-4"><Skeleton variant="text" width="80px" height="10px" /></th>
                  <th className="px-6 py-4"><Skeleton variant="text" width="60px" height="10px" /></th>
                  <th className="px-6 py-4"><Skeleton variant="text" width="70px" height="10px" /></th>
                  <th className="px-6 py-4"><Skeleton variant="text" width="50px" height="10px" /></th>
                  <th className="px-6 py-4 text-right flex justify-end"><Skeleton variant="text" width="40px" height="10px" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton variant="rect" width="40px" height="40px" className="rounded-full" />
                        <div className="space-y-2">
                           <Skeleton variant="text" width="120px" height="14px" />
                           <Skeleton variant="text" width="80px" height="10px" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <Skeleton variant="rect" width="60px" height="20px" className="rounded-md" />
                          <Skeleton variant="rect" width="60px" height="20px" className="rounded-md" />
                        </div>
                    </td>
                    <td className="px-6 py-4 space-y-2">
                       <Skeleton variant="text" width="100px" height="14px" />
                       <Skeleton variant="text" width="60px" height="10px" />
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex gap-1">
                          <Skeleton variant="rect" width="40px" height="20px" className="rounded-md" />
                          <Skeleton variant="rect" width="40px" height="20px" className="rounded-md" />
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex justify-end gap-2">
                          <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                          <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                          <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                          <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Teacher Name</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Classes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.length > 0 ? filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className={`hover:bg-slate-50/50 transition-colors ${teacher.status === 'inactive' ? 'opacity-60 bg-slate-100/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden border border-slate-200 relative">
                          {teacher.photoURL ? (
                            <NextImage 
                                src={teacher.photoURL} 
                                alt={teacher.name} 
                                fill 
                                className="object-cover" 
                            />
                          ) : (
                            teacher.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <button 
                            onClick={() => openTeacherProfile(teacher.id)}
                            className={`font-semibold text-left hover:text-primary transition-colors ${teacher.status === 'inactive' ? 'text-slate-500' : 'text-slate-800'}`}
                          >
                            {teacher.name}
                          </button>
                          <p className="text-xs text-slate-500">Faculty ID: {teacher.teacherId || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects.map(sub => (
                          <span key={sub} className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${teacher.status === 'inactive' ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700'}`}>
                            {sub}
                          </span>
                        )) : (
                          <span className="text-xs text-slate-400">Not Assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className={`${teacher.status === 'inactive' ? 'text-slate-400' : 'text-slate-700'} font-medium`}>{teacher.phone}</p>
                       <p className="text-[10px] text-slate-500">{teacher.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.grades && teacher.grades.length > 0 ? teacher.grades.map(gr => (
                          <span key={gr} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                            {gr}
                          </span>
                        )) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleStatus(teacher)}
                          title={teacher.status === 'active' ? "Deactivate Instructor" : "Re-activate Instructor"}
                          className={`p-2 transition-colors rounded-lg ${teacher.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 hover:text-green-600 hover:bg-green-50'}`}
                        >
                          {teacher.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => openTeacherProfile(teacher.id)}
                          className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 rounded-lg"
                          title="View Faculty Profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(teacher)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(teacher.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No teachers found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50">
          <p>Showing {filteredTeachers.length} faculty member{filteredTeachers.length === 1 ? '' : 's'}</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-100" disabled>Previous</button>
            <button className="px-3 py-1 bg-primary text-white rounded">1</button>
            <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-100" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
