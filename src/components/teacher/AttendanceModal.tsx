"use client";

import { useState, useEffect } from "react";
import { 
  collection, query, where, getDocs, 
  doc, writeBatch, serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, Check, UserMinus, UserCheck, Loader2, Users } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classItem: any;
  teacherData: any;
  onSuccess: () => void;
}

export default function AttendanceModal({ isOpen, onClose, classItem, teacherData, onSuccess }: AttendanceModalProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && classItem?.id) {
      loadStudents();
    }
  }, [isOpen, classItem]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "students"),
        where("enrolledClasses", "array-contains", classItem.id),
        where("status", "==", "active")
      );
      const snap = await getDocs(q);
      const studentList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(studentList);
      
      // Default everyone to present
      const initial: Record<string, boolean> = {};
      studentList.forEach(s => {
        initial[s.id] = true;
      });
      setAttendance(initial);
    } catch (error) {
      console.error("Error loading students:", error);
      toast.error("Failed to load student list.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (id: string) => {
    setAttendance(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSave = async () => {
    if (!classItem || !teacherData) return;
    setSaving(true);

    try {
      const batch = writeBatch(db);
      const sessionDateStr = classItem.date || format(new Date(), "yyyy-MM-dd");
      const completionId = classItem.uniqueSlotId || `${classItem.id}_${sessionDateStr}_${(classItem.currentSlot?.startTime || "00-00").replace(/:/g, "-")}`;
      
      // 1. Session Completion Record
      const completionRef = doc(db, "session_completions", completionId);
      const presentCount = Object.values(attendance).filter(v => v).length;

      batch.set(completionRef, {
        classId: classItem.id,
        className: classItem.name,
        teacherId: teacherData.id,
        teacherName: teacherData.name,
        date: sessionDateStr,
        dayOfWeek: classItem.dayOfWeek || format(new Date(), "eeee").toLowerCase(),
        timestamp: serverTimestamp(),
        startTime: classItem.currentSlot?.startTime || "--:--",
        endTime: classItem.currentSlot?.endTime || "--:--",
        subject: classItem.subject,
        grade: classItem.grade,
        studentCount: presentCount,
        isPaid: false,
        day: classItem.day || new Date().getDate(),
        month: classItem.month || (new Date().getMonth() + 1),
        year: classItem.year || new Date().getFullYear(),
      });

      // 2. Attendance Record
      const attendanceRef = doc(collection(db, "attendance"));
      const records = students.map(s => ({
        studentId: s.id,
        studentName: s.name,
        isPresent: attendance[s.id] || false
      }));

      batch.set(attendanceRef, {
        classId: classItem.id,
        className: classItem.name,
        teacherId: teacherData.id,
        teacherName: teacherData.name,
        grade: classItem.grade,
        subject: classItem.subject,
        date: sessionDateStr,
        completionId: completionId,
        startTime: classItem.currentSlot?.startTime || "--:--",
        records,
        totalPresent: presentCount,
        totalAbsent: students.length - presentCount,
        createdAt: serverTimestamp()
      });

      // 3. Update Class Aggregate
      const classRef = doc(db, "classes", classItem.id);
      // We don't use increment here in batch easily with existing state?
      // Actually we can just do it.
      batch.update(classRef, {
        completedSessions: (classItem.completedSessions || 0) + 1,
        sessionsSinceLastPayment: (classItem.sessionsSinceLastPayment || 0) + 1,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast.success("Attendance saved and class completed!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save records.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Student Attendance</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{classItem?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identifying Enrolled Students...</p>
            </div>
          ) : students.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {Object.values(attendance).filter(v => v).length} / {students.length} Present
                </p>
                <div className="flex gap-2">
                   <button 
                     onClick={() => {
                        const all: any = {};
                        students.forEach(s => all[s.id] = true);
                        setAttendance(all);
                     }}
                     className="text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-tighter"
                   >
                     Select All
                   </button>
                </div>
              </div>
              {students.map((student) => (
                <div 
                  key={student.id}
                  onClick={() => toggleAttendance(student.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${attendance[student.id] ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${attendance[student.id] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className={`text-sm font-bold tracking-tight ${attendance[student.id] ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {student.name}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        ID: {student.studentId || student.id.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${attendance[student.id] ? 'bg-emerald-500 text-white rotate-0' : 'bg-slate-50 text-slate-200 rotate-90'}`}>
                    {attendance[student.id] ? <UserCheck className="w-3.5 h-3.5" /> : <UserMinus className="w-3.5 h-3.5" />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-4">
              <Users className="w-12 h-12 text-slate-100 mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No active students found in this unit.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-50 bg-slate-50/30">
          <button
            onClick={handleSave}
            disabled={saving || loading || students.length === 0}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Confirm & Log Session
          </button>
        </div>
      </div>
    </div>
  );
}
