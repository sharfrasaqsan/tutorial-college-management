"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Search, Filter, Edit, Eye, Trash2 } from "lucide-react";
import { Teacher } from "@/types/models";
import Link from "next/link";
import TeacherModal from "@/components/admin/TeacherModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import NextImage from "next/image";
import toast from "react-hot-toast";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

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

  useEffect(() => {
    loadTeachers();
  }, []);

  const handleEdit = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedTeacher(null);
    setIsModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setTeacherToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!teacherToDelete) return;
    setDeleting(true);
    try {
        await deleteDoc(doc(db, "teachers", teacherToDelete));
        await deleteDoc(doc(db, "users", teacherToDelete));
        toast.success("Faculty records purged.");
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

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subjects?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Teachers Directory</h2>
          <p className="text-sm text-slate-500">Manage faculty members and their assignments.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
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
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
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
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
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
                          <p className="font-semibold text-slate-800">{teacher.name}</p>
                          <p className="text-xs text-slate-500">Employee ID: {teacher.employeeId || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {teacher.subjects && teacher.subjects.length > 0 ? teacher.subjects.map(sub => (
                          <span key={sub} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                            {sub}
                          </span>
                        )) : (
                          <span className="text-xs text-slate-400">Not Assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-slate-700 font-medium">{teacher.phone}</p>
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
                        <Link href={`/admin/teachers/${teacher.id}`} className="p-2 text-slate-400 hover:text-primary transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleEdit(teacher)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(teacher.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
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
          <p>Showing {filteredTeachers.length} faculty members</p>
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
