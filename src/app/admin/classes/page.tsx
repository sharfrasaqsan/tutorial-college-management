"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, BookOpen, Clock, Users, Calendar, Edit, Trash2 } from "lucide-react";
import { Class } from "@/types/models";
import Link from "next/link";
import ClassModal from "@/components/admin/ClassModal";
import toast from "react-hot-toast";

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "classes"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    } catch (error) {
      console.error("Error loading classes", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const handleEdit = (item: Class) => {
    setSelectedClass(item);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure? Terminating this class session will remove its current schedule.")) {
      try {
        await deleteDoc(doc(db, "classes", id));
        toast.success("Class schedule removed.");
        loadClasses();
      } catch (error) {
        toast.error("Failed to terminate class.");
      }
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
           <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg> 
            Filters
           </button>
        </div>
      </div>

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
        ) : filteredClasses.length > 0 ? filteredClasses.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {item.status || 'Active'}
              </span>
            </div>
            
            <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-primary transition-colors">{item.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{item.subject} • {item.grade}</p>
            
            <div className="space-y-3 mt-auto">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{item.studentCount || 0} Students Enrolled</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{item.dayOfWeek?.charAt(0).toUpperCase() + item.dayOfWeek?.slice(1) || 'Multiple Days'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{item.startTime} - {item.endTime}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-50 flex gap-2">
              <Link href={`/admin/classes/${item.id}`} className="flex-1 px-3 py-2 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-center hover:bg-slate-100 transition-colors">
                Details
              </Link>
              <button 
                onClick={() => handleEdit(item)}
                className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(item.id)}
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-500">No classes found matching your criteria.</p>
            <button className="mt-4 text-sm font-medium text-primary hover:underline">Clear search filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
