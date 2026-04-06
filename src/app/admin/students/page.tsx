"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Search, Filter, Edit, Eye, Trash2, Ban, CheckCircle, X } from "lucide-react";
import { Student, Grade, Subject } from "@/types/models";
import Link from "next/link";
import StudentModal from "@/components/admin/StudentModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [classesList, setClassesList] = useState<Record<string, boolean>>({});
  
  const loadStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    } catch (error) {
      console.error("Error loading students", error);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialData = async () => {
    try {
      const [gradeSnap, subjectSnap, classSnap] = await Promise.all([
        getDocs(query(collection(db, "grades"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "subjects"), orderBy("name", "asc"))),
        getDocs(collection(db, "classes"))
      ]);
      setGrades(gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
      setSubjects(subjectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      
      const classMap: Record<string, boolean> = {};
      classSnap.docs.forEach(d => classMap[d.id] = true);
      setClassesList(classMap);
    } catch (error) {
      console.error("Error loading filters data", error);
    }
  }

  useEffect(() => {
    loadStudents();
    loadInitialData();
  }, []);

  const toggleStatus = async (student: Student) => {
    try {
      const newStatus = student.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, "students", student.id), { status: newStatus || 'active' });
      toast.success(newStatus === 'active' ? "Student account restored." : "Student account suspended.");
      loadStudents();
    } catch {
      toast.error("Status update failed.");
    }
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedStudent(null);
    setIsModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setStudentToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    const batch = writeBatch(db);
    try {
        const student = students.find(s => s.id === studentToDelete);
        if (student) {
          // 1. Decrement Grade Count
          if (student.gradeId && grades.some(g => g.id === student.gradeId)) {
            batch.update(doc(db, "grades", student.gradeId), { studentCount: increment(-1) });
          }

          // 2. Decrement Class Counts
          student.enrolledClasses?.forEach(cid => {
            if (classesList[cid]) {
              batch.update(doc(db, "classes", cid), { studentCount: increment(-1) });
            }
          });

          // 3. Decrement Subject Counts
          student.enrolledSubjects?.forEach(sid => {
            if (subjects.some(s => s.id === sid)) {
              batch.update(doc(db, "subjects", sid), { studentCount: increment(-1) });
            }
          });
        }

        // 4. Delete Student
        batch.delete(doc(db, "students", studentToDelete));
        
        await batch.commit();
        toast.success("Student record purged and enrollment counts updated.");
        setIsDeleteOpen(false);
        setStudentToDelete(null);
        loadStudents();
    } catch (error) {
        console.error("Error deleting student:", error);
        toast.error("Process failed.");
    } finally {
        setDeleting(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.phone?.includes(searchTerm)) ||
      (s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()));
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Students Directory</h2>
          <p className="text-sm text-slate-500">Manage all student enrollments and records.</p>
        </div>
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors flex items-center gap-2 shadow-sm shadow-primary/20"
        >
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>

      <StudentModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }} 
        onSuccess={loadStudents}
        initialData={selectedStudent}
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => {
            setIsDeleteOpen(false);
            setStudentToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Student Record"
        message="This action will permanently remove all enrollment data, attendance history, and payment logs associated with this student from the cloud. This cannot be undone."
      />

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
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
            {(filterGrade || filterSubject || filterStatus) && (
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-top duration-300">
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Grade Level</label>
                <select 
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Grades</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subject Enrollment</label>
                <select 
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">All Subjects</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
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
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                   <th className="px-6 py-4">Student Name</th>
                   <th className="px-6 py-4">Contact</th>
                   <th className="px-6 py-4">Enrollments</th>
                   <th className="px-6 py-4">School</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length > 0 ? filteredStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-slate-50/50 transition-colors ${student.status === 'inactive' ? 'opacity-60 bg-slate-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${student.status === 'inactive' ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary'}`}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`font-semibold ${student.status === 'inactive' ? 'text-slate-500' : 'text-slate-800'}`}>{student.name}</p>
                          <p className="text-xs text-slate-500">ID: {student.studentId || student.id.substring(0,6).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`${student.status === 'inactive' ? 'text-slate-400' : 'text-slate-700'} font-medium`}>{student.phone || student.parentPhone}</p>
                      <p className="text-xs text-slate-500">{student.parentName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-700">{student.grade || 'N/A'}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          {(student.enrolledClasses?.length || 0)} Classes
                        </span>
                        <span className="text-[10px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          {(student.enrolledSubjects?.length || 0)} Subjects
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{student.schoolName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${student.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {student.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleStatus(student)}
                          title={student.status === 'active' ? "Suspend Account" : "Restore Account"}
                          className={`p-2 transition-colors rounded-lg ${student.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-amber-600 hover:text-green-600 hover:bg-green-50'}`}
                        >
                          {student.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <Link href={`/admin/students/${student.id}`} className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleEdit(student)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => confirmDelete(student.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No students found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50">
          <p>Showing {filteredStudents.length} entries</p>
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
