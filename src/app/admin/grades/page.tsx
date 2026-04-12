"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Layers, Plus, Search, Filter, Calendar, User, Edit, Trash2, Ban, CheckCircle } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Grade } from "@/types/models";
import GradeModal from "@/components/admin/GradeModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [gradeToDelete, setGradeToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadGrades = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "grades"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setGrades(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
    } catch (error) {
      console.error("Error loading grades", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGrades();
  }, []);

  const toggleStatus = async (item: Grade) => {
    try {
        const newStatus = item.status === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, "grades", item.id), { status: newStatus });
        toast.success(newStatus === 'active' ? "Grade parameters restored." : "Grade parameters suspended.");
        loadGrades();
    } catch {
        toast.error("Process failed.");
    }
  };

  const handleEdit = (grade: Grade) => {
    setSelectedGrade(grade);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedGrade(null);
    setIsModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setGradeToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!gradeToDelete) return;
    setDeleting(true);
    try {
        const batch = writeBatch(db);

        // Auto-Deactivate associated classes
        const classQuery = query(collection(db, "classes"), where("gradeId", "==", gradeToDelete));
        const classSnap = await getDocs(classQuery);
        classSnap.docs.forEach(cdoc => {
          batch.update(doc(db, "classes", cdoc.id), { status: 'inactive' });
        });

        batch.delete(doc(db, "grades", gradeToDelete));
        
        await batch.commit();
        toast.success("Grade parameter removed. Related classes suspended.");
        setIsDeleteOpen(false);
        setGradeToDelete(null);
        loadGrades();
    } catch (error) {
        console.error("Error deleting grade:", error);
        toast.error("Process failed.");
    } finally {
        setDeleting(false);
    }
  };

  const filteredGrades = grades.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Grade Management</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">
            Configure academic levels and their requirements
          </p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add Grade Level
        </button>
      </div>

      <GradeModal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setSelectedGrade(null);
        }} 
        onSuccess={loadGrades}
        initialData={selectedGrade}
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => {
            setIsDeleteOpen(false);
            setGradeToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Remove Grade Parameter"
        message="Are you sure you want to delete this grade level? This may cause inconsistencies in student reporting and historical class data."
      />

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by grade name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
            />
          </div>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Grade Level</th>
                  <th className="px-6 py-4">Students</th>
                  <th className="px-6 py-4">Classes</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                        <Skeleton variant="text" width="100px" height="14px" />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <Skeleton variant="text" width="80px" height="14px" />
                    </td>
                    <td className="px-6 py-5">
                       <Skeleton variant="text" width="120px" height="14px" />
                    </td>
                    <td className="px-6 py-5">
                       <Skeleton variant="rect" width="70px" height="24px" className="rounded-md" />
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                       <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                       <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                       <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px] border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Grade Level</th>
                  <th className="px-6 py-4">Students</th>
                  <th className="px-6 py-4">Classes</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {filteredGrades.length > 0 ? filteredGrades.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${item.status === 'inactive' ? 'opacity-60 bg-slate-100/30' : ''}`}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${item.status === 'inactive' ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary'}`}>
                           <Layers className="w-4 h-4" />
                        </div>
                        <p className={`font-bold ${item.status === 'inactive' ? 'text-slate-400' : 'text-slate-800'}`}>{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-300" />
                        {item.studentCount || 0} enrolled student{item.studentCount === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {item.classCount || 0} active section{item.classCount === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {item.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleStatus(item)}
                          title={item.status === 'active' ? "Suspend Grade" : "Restore Grade"}
                          className={`p-2 transition-colors rounded-lg ${item.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 hover:text-green-600 hover:bg-green-50'}`}
                        >
                          {item.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-all hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center flex flex-col items-center">
                       <Layers className="w-12 h-12 text-slate-100 mb-4" />
                       <p className="text-slate-500 font-medium">No grade levels found in the system configuration.</p>
                       <button className="mt-2 text-primary hover:underline text-xs font-bold font-black tracking-widest uppercase">Initialize Default Grades</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
