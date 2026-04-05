"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, BookType, Hash, Search, Filter, BookOpen, Edit, Trash2, Ban, CheckCircle } from "lucide-react";
import { Subject } from "@/types/models";
import SubjectModal from "@/components/admin/SubjectModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "subjects"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    } catch (error) {
      console.error("Error loading subjects", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, []);

  const toggleStatus = async (item: Subject) => {
    try {
        const newStatus = item.status === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, "subjects", item.id), { status: newStatus });
        toast.success(newStatus === 'active' ? "Subject restored." : "Subject suspended.");
        loadSubjects();
    } catch {
        toast.error("Failed to update subject status.");
    }
  };

  const handleEdit = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedSubject(null);
    setIsModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setSubjectToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!subjectToDelete) return;
    setDeleting(true);
    try {
        await deleteDoc(doc(db, "subjects", subjectToDelete));
        toast.success("Subject definition purged.");
        setIsDeleteOpen(false);
        setSubjectToDelete(null);
        loadSubjects();
    } catch (error) {
        console.error("Error deleting subject:", error);
        toast.error("Process failed.");
    } finally {
        setDeleting(false);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subjectCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subject Repository</h2>
          <p className="text-sm text-slate-500">Manage all academic subjects and curriculum details.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add New Subject
        </button>
      </div>

      <SubjectModal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setSelectedSubject(null);
        }} 
        onSuccess={loadSubjects}
        initialData={selectedSubject}
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => {
            setIsDeleteOpen(false);
            setSubjectToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Purge Subject Definition"
        message="Are you sure you want to remove this subject? All academic linkings and curriculum mappings for this subject will be dissolved. Historical records will be archived but not editable."
      />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name or code..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
          />
        </div>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filters
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
             [1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse"></div>)
          ) : filteredSubjects.length > 0 ? filteredSubjects.map((item) => (
          <div key={item.id} className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 ${item.status === 'inactive' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            <div className="flex justify-between items-start mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.status === 'inactive' ? 'bg-slate-100 text-slate-400' : (item.color || 'bg-slate-100 text-slate-600')}`}>
                  <BookType className="w-6 h-6" />
              </div>
              <div className="flex gap-1">
                 <button 
                  onClick={() => toggleStatus(item)}
                  title={item.status === 'active' ? "Mark Unavailable" : "Mark Available"}
                  className={`p-2 transition-all rounded-lg ${item.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 hover:text-green-600 hover:bg-green-50'}`}
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
              </div>
            </div>
            <h3 className={`text-lg font-bold mb-1 ${item.status === 'inactive' ? 'text-slate-400' : 'text-slate-800'}`}>{item.name}</h3>
            {item.status === 'inactive' && <p className="text-[10px] font-black uppercase text-amber-600 mb-2 tracking-tighter">Temporarily Unavailable</p>}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase">
                <Hash className="w-3 h-3 text-primary" /> {item.subjectCode || 'No Code'}
            </div>
            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">{item.studentCount || 0} Students</p>
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-bold saturate-50">{i}</div>)}
                </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
             <BookOpen className="w-12 h-12 text-slate-100 mb-4" />
             <p className="text-slate-500 font-medium">No subjects found in the repository.</p>
             <button className="mt-4 text-xs font-bold text-primary hover:underline">Define new subject category</button>
          </div>
        )}
      </div>
    </div>
  );
}
