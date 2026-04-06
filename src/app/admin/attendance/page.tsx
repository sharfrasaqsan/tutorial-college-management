"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Check, X, Calendar, Users, CheckCircle2 } from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Student, Class } from "@/types/models";
import toast from "react-hot-toast";

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [attendanceData, setAttendanceData] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadClasses() {
      try {
        const q = query(collection(db, "classes"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      } catch (error) {
        console.error("Error loading classes", error);
      }
    }
    loadClasses();
  }, []);

  const handleClassChange = async (classId: string) => {
    setSelectedClass(classId);
    if (!classId) return setStudents([]);
    
    setLoading(true);
    try {
      // In a real app, you would query students enrolled in this class
      // For now, we'll fetch all students as a placeholder
      const q = query(collection(db, "students"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      const studentList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(studentList);
      
      // Initialize all as present by default
      const initialAttendance: Record<string, boolean> = {};
      studentList.forEach(s => initialAttendance[s.id] = true);
      setAttendanceData(initialAttendance);
    } catch (error) {
      console.error("Error loading students for class", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (studentId: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleSubmit = async () => {
    if (!selectedClass) return toast.error("Please select a class first");
    
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const dupQuery = query(
        collection(db, "attendance"),
        where("classId", "==", selectedClass),
        where("date", "==", today)
      );
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        toast.error("Attendance for this class has already been marked for today.");
        setSubmitting(false);
        return;
      }

      await addDoc(collection(db, "attendance"), {
        classId: selectedClass,
        date: new Date().toISOString().split('T')[0],
        records: attendanceData,
        createdAt: serverTimestamp()
      });
      toast.success("Attendance marked successfully!");
    } catch (error) {
      console.error("Error marking attendance", error);
      toast.error("Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Daily Attendance</h2>
          <p className="text-sm text-slate-500">Track and monitor student presence in classes.</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedClass}
            onChange={(e) => handleClassChange(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            <option value="">Select a Class</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      </div>

      {!selectedClass ? (
        <div className="py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
             <Users className="w-10 h-10 text-slate-200" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Select a Class to Start</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">Please choose a class from the dropdown above to mark attendance for today&apos;s session.</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/20 rounded-3xl border border-slate-100">
           {[1, 2, 3, 4, 5, 6].map(i => (
             <div key={i} className="p-4 rounded-2xl border-2 border-slate-100 bg-white flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                   <Skeleton variant="rect" width="40px" height="40px" className="rounded-xl" />
                   <div className="space-y-2">
                      <Skeleton variant="text" width="100px" height="14px" />
                      <Skeleton variant="text" width="60px" height="10px" />
                   </div>
                </div>
                <Skeleton variant="rect" width="24px" height="24px" className="rounded-lg" />
             </div>
           ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
             <div className="flex gap-4">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Class: <span className="text-slate-800">{classes.find(c => c.id === selectedClass)?.name}</span></div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">Total: <span className="text-slate-800">{students.length} Students</span></div>
             </div>
             <div className="flex gap-2">
                <button onClick={() => {
                  const allPresent: Record<string, boolean> = {};
                  students.forEach(s => allPresent[s.id] = true);
                  setAttendanceData(allPresent);
                }} className="text-[10px] font-black uppercase tracking-tighter text-primary hover:underline">Mark All Present</button>
             </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/20">
            {students.map((student) => (
              <button 
                key={student.id}
                onClick={() => toggleAttendance(student.id)}
                className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${attendanceData[student.id] ? 'bg-white border-primary shadow-lg shadow-primary/5 scale-105' : 'bg-white border-slate-100 opacity-60 grayscale'}`}
              >
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${attendanceData[student.id] ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {student.name.charAt(0)}
                   </div>
                   <div className="text-left">
                      <p className={`font-bold text-sm ${attendanceData[student.id] ? 'text-slate-800' : 'text-slate-400'}`}>{student.name}</p>
                      <p className="text-[10px] font-medium text-slate-400">ID: {student.id.substring(0,6).toUpperCase()}</p>
                   </div>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${attendanceData[student.id] ? 'bg-primary/20 text-primary' : 'bg-slate-100 text-slate-300'}`}>
                  {attendanceData[student.id] ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </div>
              </button>
            ))}
          </div>

          <div className="p-6 border-t border-slate-100 bg-white flex justify-end items-center gap-4">
             <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Marking For Today</p>
                <p className="text-sm font-black text-slate-800 tracking-tight">{Object.values(attendanceData).filter(v => v).length} Present / {Object.values(attendanceData).filter(v => !v).length} Absent</p>
             </div>
             <button 
               onClick={handleSubmit} 
               disabled={submitting}
               className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
             >
               {submitting ? 'Saving...' : (
                 <>
                   <CheckCircle2 className="w-4 h-4" /> Submit Attendance
                 </>
               )}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
