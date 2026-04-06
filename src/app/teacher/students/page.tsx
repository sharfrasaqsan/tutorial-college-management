"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, Search, Filter, BookOpen, Clock, Activity, MessageSquare, Phone, Edit, X } from "lucide-react";
import { Student, Teacher, Grade, Subject } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import StudentModal from "@/components/admin/StudentModal";

export default function MyStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  const loadData = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const tSnap = await getDocs(query(collection(db, "teachers"), where("id", "==", user.uid)));
      if (!tSnap.empty) {
        const tInfo = { id: tSnap.docs[0].id, ...tSnap.docs[0].data() } as Teacher;
        setTeacherData(tInfo);

        // Fetch students in the grades the teacher handles
        if (tInfo.grades && tInfo.grades.length > 0) {
          const sSnap = await getDocs(query(collection(db, "students"), where("grade", "in", tInfo.grades)));
          setStudents(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
        }

        // Load all subjects for filtering
        const subSnap = await getDocs(query(collection(db, "subjects"), orderBy("name", "asc")));
        setAllSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      }
    } catch (error) {
      console.error("Error loading student data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm);
    const matchesGrade = filterGrade === "" || s.grade === filterGrade;
    const matchesStatus = filterStatus === "" || s.status === filterStatus;
    const matchesSubject = filterSubject === "" || (s.enrolledSubjects && s.enrolledSubjects.includes(filterSubject));
    
    return matchesSearch && matchesGrade && matchesStatus && matchesSubject;
  });

  const clearFilters = () => {
    setFilterGrade("");
    setFilterSubject("");
    setFilterStatus("");
    setSearchTerm("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                <Users className="w-8 h-8 text-indigo-600" /> Student Directory
            </h2>
            <p className="text-slate-500 font-medium max-w-lg">Viewing {students.length} students enrolled in your academic levels. You can monitor their profiles and academic contact details.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or contact..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium shadow-sm"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl border transition-all font-black text-[10px] uppercase tracking-widest ${showFilters ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <Filter className="w-4 h-4" /> Filters
            { (filterGrade || filterSubject || filterStatus) && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse ml-1 opacity-0 group-hover:opacity-100"></span> }
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-300">
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Grade Level</label>
              <select 
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
              >
                <option value="">All Taught Grades</option>
                {teacherData?.grades?.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">By Subject</label>
              <select 
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
              >
                <option value="">All Subjects</option>
                {allSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
           </div>
           <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Status</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Suspended</option>
              </select>
           </div>
           <div className="flex items-end">
              <button 
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all h-[42px] flex items-center justify-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> Clear All
              </button>
           </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-slate-50">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-slate-50/50 animate-pulse"></div>)
          ) : filteredStudents.length > 0 ? filteredStudents.map((s) => (
            <div key={s.id} className="p-8 hover:bg-indigo-50/20 transition-all group flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-500 mb-6 font-black text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 relative">
                   {s.name.charAt(0)}
                   {s.status === 'active' && (
                       <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-white"></div>
                   )}
                </div>
                
                <h4 className="text-lg font-black text-slate-800 mb-1 leading-tight">{s.name}</h4>
                <div className="flex flex-col gap-1 items-center mb-6">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{s.grade}</p>
                    {s.enrolledSubjects && s.enrolledSubjects.length > 0 && (
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">
                            {s.enrolledSubjects.length} Subjects Enrolled
                        </p>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-2 w-full mt-auto">
                    <div className="bg-slate-50 p-3 rounded-2xl flex flex-col items-center">
                        <Phone className="w-3.5 h-3.5 text-slate-400 mb-1" />
                        <span className="text-[10px] font-bold text-slate-600">{s.phone}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl flex flex-col items-center">
                        <Activity className="w-3.5 h-3.5 text-emerald-400 mb-1" />
                        <span className="text-[10px] font-bold text-slate-600">92% Attnd.</span>
                    </div>
                </div>

                <div className="flex gap-2 w-full mt-4">
                    <button 
                        onClick={() => handleEdit(s)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                    >
                        <Edit className="w-3 h-3" /> Enroll
                    </button>
                    <button className="flex-1 bg-indigo-600 text-white rounded-xl py-2 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
                        View Profile
                    </button>
                </div>
            </div>
          )) : (
            <div className="col-span-full py-40 text-center flex flex-col items-center">
                <Users className="w-16 h-16 text-slate-100 mb-4" />
                <p className="text-slate-500 font-bold text-lg mb-1 tracking-tight">No students found matching your criteria.</p>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400">Total Records: {students.length}</p>
            </div>
          )}
        </div>
      </div>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }} 
        onSuccess={loadData}
        initialData={selectedStudent}
      />
    </div>
  );
}
