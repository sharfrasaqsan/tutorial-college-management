"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, BookType, Hash, Search, Filter, BookOpen } from "lucide-react";
import { Subject } from "@/types/models";
import AddSubjectModal from "@/components/admin/AddSubjectModal";

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add New Subject
        </button>
      </div>

      <AddSubjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadSubjects}
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
          <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${item.color || 'bg-slate-100 text-slate-600'}`}>
                <BookType className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{item.name}</h3>
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
