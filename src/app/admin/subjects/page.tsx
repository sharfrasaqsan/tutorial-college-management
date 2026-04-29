"use client";

import { useState, useEffect } from "react";
import { collection, query, onSnapshot, getDocs, orderBy, doc, updateDoc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, BookType, Hash, Search, Filter, BookOpen, Edit, Trash2, Ban, CheckCircle, Users, CreditCard, Briefcase, ArrowRight, Projector, AlertTriangle, History } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Subject } from "@/types/models";
import SubjectModal from "@/components/admin/SubjectModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useDashboard } from "@/hooks/useDashboard";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function SubjectsPage() {
  const { stats, isLoading: statsLoading } = useDashboard();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "subjects"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to subjects:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleStatus = async (item: Subject) => {
    try {
        const newStatus = item.status === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, "subjects", item.id), { status: newStatus });
        toast.success(newStatus === 'active' ? "Subject restored and set to active." : "Subject archived successfully.");
    } catch {
        toast.error("Failed to update subject status. Please try again.");
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
        const batch = writeBatch(db);

        // Auto-Deactivate associated classes
        const classQuery = query(collection(db, "classes"), where("subjectId", "==", subjectToDelete));
        const classSnap = await getDocs(classQuery);
        classSnap.docs.forEach(cdoc => {
          batch.update(doc(db, "classes", cdoc.id), { status: 'inactive' });
        });

        batch.delete(doc(db, "subjects", subjectToDelete));
        
        await batch.commit();
        toast.success("Subject removed. Associated classes have been suspended.");
        setIsDeleteOpen(false);
        setSubjectToDelete(null);
    } catch (error) {
        console.error("Error deleting subject:", error);
        toast.error("Failed to remove subject. Please try again.");
    } finally {
        setDeleting(false);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.subjectCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statCards = [
    { title: "Total Subjects", value: subjects.length, icon: BookOpen, color: "text-blue-500" },
    { title: "Active Curriculum", value: subjects.filter(s => s.status === 'active').length, icon: CheckCircle, color: "text-emerald-500" },
    { title: "Archived Subjects", value: subjects.filter(s => s.status === 'inactive').length, icon: Ban, color: "text-rose-500" },
    { title: "Global Enrollment", value: stats?.totalStudents || 0, icon: Users, color: "text-indigo-500" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subject Repository</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">
            Manage all academic subjects and curriculum details
          </p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add New Subject
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

      <SubjectModal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setSelectedSubject(null);
        }} 
        onSuccess={() => {}}
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
             [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                        <Skeleton variant="rect" width="48px" height="48px" className="rounded-xl" />
                        <div className="flex gap-1">
                            <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                            <Skeleton variant="rect" width="32px" height="32px" className="rounded-lg" />
                        </div>
                    </div>
                    <Skeleton variant="text" width="100%" height="24px" />
                    <Skeleton variant="text" width="60%" height="14px" />
                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                        <Skeleton variant="text" width="40%" height="12px" />
                        <div className="flex -space-x-2">
                            <Skeleton variant="circle" width="24px" height="24px" className="border-2 border-white" />
                            <Skeleton variant="circle" width="24px" height="24px" className="border-2 border-white" />
                        </div>
                    </div>
                </div>
             ))
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
                <p className="text-xs text-slate-500 font-medium">{item.studentCount || 0} Student{item.studentCount === 1 ? '' : 's'} Enrolled</p>
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${item.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    {item.status === 'active' ? 'Active' : 'Archived'}
                </span>
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
