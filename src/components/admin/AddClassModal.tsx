"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, BookOpen, Calendar, Clock, MapPin } from "lucide-react";
import { Teacher, Grade, Subject } from "@/types/models";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";

const classSchema = z.object({
  name: z.string().min(3, "Class name must be at least 3 characters"),
  subjectId: z.string().min(1, "Subject is required"),
  gradeId: z.string().min(1, "Grade is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  dayOfWeek: z.string().min(1, "Day of week is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  room: z.string().min(1, "Room/Hall is required"),
  status: z.enum(["active", "inactive"]),
});

type ClassForm = z.infer<typeof classSchema>;

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddClassModal({ isOpen, onClose, onSuccess }: AddClassModalProps) {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [teachersSnap, gradesSnap, subjectsSnap] = await Promise.all([
          getDocs(query(collection(db, "teachers"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "grades"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "subjects"), orderBy("name", "asc")))
        ]);

        setTeachers(teachersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
        setGrades(gradesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
        setSubjects(subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      } catch (error) {
        console.error("Error loading dropdown data:", error);
      }
    }
    if (isOpen) loadData();
  }, [isOpen]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      status: "active",
      dayOfWeek: "monday",
    }
  });

  const onSubmit = async (data: ClassForm) => {
    setLoading(true);
    try {
      // Find names for denormalization to keep dashboard quick
      const selectedTeacher = teachers.find(t => t.id === data.teacherId);
      const selectedSubject = subjects.find(s => s.id === data.subjectId);
      const selectedGrade = grades.find(g => g.id === data.gradeId);

      await addDoc(collection(db, "classes"), {
        ...data,
        teacherName: selectedTeacher?.name || "",
        subjectName: selectedSubject?.name || "",
        gradeName: selectedGrade?.name || "",
        studentCount: 0,
        createdAt: serverTimestamp(),
      });

      toast.success("Class successfully scheduled!");
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding class:", error);
      toast.error("Failed to schedule class. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule New Academic Class">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module Selection */}
          <div className="space-y-4 col-span-full">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> Curriculum Setup
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Class Display Name</label>
                  <input 
                    {...register("name")}
                    placeholder="e.g. Physics 2026 Batch - A"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Subject</label>
                  <select 
                    {...register("subjectId")}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="">Select Subject</option>
                    {subjects.length > 0 ? subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.subjectCode})</option>) : null}
                  </select>
                  {subjects.length === 0 && <p className="text-[10px] text-amber-600 mt-1 ml-1 flex items-center gap-1">No subjects found. <a href="/admin/subjects" className="underline font-bold">Add One</a></p>}
                  {errors.subjectId && <p className="text-xs text-red-500 ml-1 mt-1">{errors.subjectId.message}</p>}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Grade Level</label>
                  <select 
                    {...register("gradeId")}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="">Select Grade</option>
                    {grades.length > 0 ? grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : null}
                  </select>
                  {grades.length === 0 && <p className="text-[10px] text-amber-600 mt-1 ml-1 flex items-center gap-1">No grades found. <a href="/admin/grades" className="underline font-bold">Add One</a></p>}
                  {errors.gradeId && <p className="text-xs text-red-500 ml-1 mt-1">{errors.gradeId.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Assigned Teacher</label>
                  <select 
                    {...register("teacherId")}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="">Select Instructor</option>
                    {teachers.length > 0 ? teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : null}
                  </select>
                  {teachers.length === 0 && <p className="text-[10px] text-amber-600 mt-1 ml-1 flex items-center gap-1">No teachers registered. <a href="/admin/teachers" className="underline font-bold">Register Now</a></p>}
                  {errors.teacherId && <p className="text-xs text-red-500 ml-1 mt-1">{errors.teacherId.message}</p>}
                </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
             <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Timing & Location
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Day</label>
                  <select 
                    {...register("dayOfWeek")}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2"><Clock className="w-3 h-3 text-slate-400" /> Start</label>
                  <input 
                    {...register("startTime")}
                    type="time"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.startTime && <p className="text-xs text-red-500 ml-1 mt-1">{errors.startTime.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2"><Clock className="w-3 h-3 text-slate-400" /> End</label>
                  <input 
                    {...register("endTime")}
                    type="time"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.endTime && <p className="text-xs text-red-500 ml-1 mt-1">{errors.endTime.message}</p>}
                </div>
             </div>
             
             <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Hall / Room Number</label>
                <input 
                  {...register("room")}
                  placeholder="e.g. Main Hall 01 / Room 204"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
                {errors.room && <p className="text-xs text-red-500 ml-1 mt-1">{errors.room.message}</p>}
             </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 flex-col sm:flex-row">
          <button 
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authorize Class"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
