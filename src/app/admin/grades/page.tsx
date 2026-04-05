"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Layers, Plus, Search, Filter, Calendar, User, Edit, Trash2 } from "lucide-react";
import { Grade } from "@/types/models";
import GradeModal from "@/components/admin/GradeModal";
import toast from "react-hot-toast";

export default function GradesPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

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

  const handleEdit = (grade: Grade) => {
    setSelectedGrade(grade);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedGrade(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? Removing this grade level may disrupt linked student and class records.")) {
      try {
        await deleteDoc(doc(db, "grades", id));
        toast.success("Grade level removed.");
        loadGrades();
      } catch (error) {
        toast.error("Failed to delete record.");
      }
    }
  };

  const filteredGrades = grades.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Grade Management</h2>
          <p className="text-sm text-slate-500">Configure academic levels and their requirements.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add Grade Level
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
             <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
             </div>
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
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                           <Layers className="w-4 h-4" />
                        </div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-300" />
                        {item.studentCount || 0} enrolled
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {item.classCount || 0} active sections
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-all hover:bg-blue-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
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
