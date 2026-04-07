"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, getDocs, query, orderBy, serverTimestamp, doc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, BookOpen, Calendar, Clock, Plus, Trash2 } from "lucide-react";
import { Teacher, Grade, Subject, Class } from "@/types/models";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";

const scheduleSchema = z.object({
  dayOfWeek: z.string().min(1, "Day is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  room: z.string().min(1, "Room is required"),
});

const classSchema = z.object({
  name: z.string().min(3, "Class name must be at least 3 characters"),
  subjectId: z.string().min(1, "Subject is required"),
  gradeId: z.string().min(1, "Grade is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  schedules: z.array(scheduleSchema).min(1, "At least one schedule is required"),
  monthlyFee: z.coerce.number().min(0, "Fee must be a positive number"),
  status: z.enum(["active", "inactive"]),
});

type ClassForm = z.infer<typeof classSchema>;

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Class | null;
  fixedTeacherId?: string;
}

export default function ClassModal({ isOpen, onClose, onSuccess, initialData, fixedTeacherId }: ClassModalProps) {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(classSchema),
    defaultValues: {
      status: "active",
      name: "",
      teacherId: fixedTeacherId || "",
      monthlyFee: 0,
      schedules: [{ dayOfWeek: "monday", startTime: "", endTime: "", room: "" }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "schedules",
  });

  useEffect(() => {
    async function loadData() {
      setMetaLoading(true);
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
      } finally {
        setMetaLoading(false);
      }
    }
    if (isOpen) loadData();
  }, [isOpen]);

  const watchedGradeId = watch("gradeId");
  const watchedSubjectId = watch("subjectId");
  const watchedTeacherId = watch("teacherId");

  useEffect(() => {
    if (fixedTeacherId) {
        setValue("teacherId", fixedTeacherId);
    }
  }, [fixedTeacherId, setValue, isOpen]);

  useEffect(() => {
    if (watchedGradeId && watchedSubjectId && watchedTeacherId) {
      const g = grades.find(x => x.id === watchedGradeId);
      const s = subjects.find(x => x.id === watchedSubjectId);
      const t = teachers.find(x => x.id === watchedTeacherId);

      if (g && s && t) {
        setValue("name", `${g.name} • ${s.name} (${t.name})`);
      }
    }
  }, [watchedGradeId, watchedSubjectId, watchedTeacherId, grades, subjects, teachers, setValue]);

  // Filter logic
  const fixedTeacher = teachers.find(t => t.id === fixedTeacherId);

  const filteredGrades = grades.filter(g => {
    if (!fixedTeacherId) return true;
    return fixedTeacher?.grades?.includes(g.name);
  });

  const filteredSubjects = subjects.filter(sub => {
    if (fixedTeacherId) {
      const selectedGradeName = grades.find(g => g.id === watchedGradeId)?.name;
      return fixedTeacher?.subjects?.includes(sub.name) && (!watchedGradeId || fixedTeacher?.grades?.includes(selectedGradeName || ""));
    }
    if (!watchedGradeId) return true;
    const selectedGradeName = grades.find(g => g.id === watchedGradeId)?.name;
    return teachers.some(t => 
      t.grades?.includes(selectedGradeName || "") && 
      t.subjects?.includes(sub.name)
    );
  });

  const filteredTeachers = teachers.filter(t => {
    if (fixedTeacherId) return t.id === fixedTeacherId;
    const selectedGradeName = grades.find(g => g.id === watchedGradeId)?.name;
    const selectedSubjectName = subjects.find(s => s.id === watchedSubjectId)?.name;

    const matchesGrade = !watchedGradeId || t.grades?.includes(selectedGradeName || "");
    const matchesSubject = !watchedSubjectId || t.subjects?.includes(selectedSubjectName || "");

    return matchesGrade && matchesSubject && t.status === 'active';
  });

  useEffect(() => {
    if (!watchedGradeId) {
      setValue("subjectId", "");
      setValue("teacherId", "");
    }
  }, [watchedGradeId, setValue]);

  useEffect(() => {
    if (!watchedSubjectId) {
      setValue("teacherId", "");
    }
  }, [watchedSubjectId, setValue]);

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        subjectId: initialData.subjectId || "",
        gradeId: initialData.gradeId || "",
        teacherId: initialData.teacherId,
        schedules: initialData.schedules || [{ dayOfWeek: "monday", startTime: "", endTime: "", room: "" }],
        status: initialData.status || "active",
        monthlyFee: initialData.monthlyFee || 0,
      });
    } else {
      reset({
        name: "",
        subjectId: "",
        gradeId: "",
        teacherId: "",
        schedules: [{ dayOfWeek: "monday", startTime: "", endTime: "", room: "" }],
        status: "active",
        monthlyFee: 0,
      });
    }
  }, [initialData, reset, isOpen]);

  const onSubmit = async (data: ClassForm) => {
    setLoading(true);
    const batch = writeBatch(db);
    try {
      const selectedTeacher = teachers.find(t => t.id === data.teacherId);
      const selectedSubject = subjects.find(s => s.id === data.subjectId);
      const selectedGrade = grades.find(g => g.id === data.gradeId);

      const classData = {
        ...data,
        teacherName: selectedTeacher?.name || "",
        subject: selectedSubject?.name || "",
        grade: selectedGrade?.name || "",
        updatedAt: serverTimestamp(),
      };

      if (initialData) {
        if (initialData.gradeId !== data.gradeId) {
          if (initialData.gradeId) {
            batch.update(doc(db, "grades", initialData.gradeId), { classCount: increment(-1) });
          }
          if (data.gradeId) {
            batch.update(doc(db, "grades", data.gradeId), { classCount: increment(1) });
          }
        }
        
        batch.update(doc(db, "classes", initialData.id), classData);
        await batch.commit();
        toast.success("Class schedule updated!");
      } else {
        const classRef = doc(collection(db, "classes"));
        if (data.gradeId) {
          batch.update(doc(db, "grades", data.gradeId), { classCount: increment(1) });
        }

        batch.set(classRef, {
          ...classData,
          studentCount: 0,
          createdAt: serverTimestamp(),
        });
        
        await batch.commit();
        toast.success("New class successfully scheduled!");
      }

      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving class:", error);
      toast.error("Failed to save class schedule.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={initialData ? "Adjust Class Schedule" : "Schedule New Academic Class"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 col-span-full">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> Curriculum Setup
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1 flex justify-between items-center">
                    Class Display Name <span className="text-[10px] text-primary/60 font-black uppercase tracking-widest">(Auto-Generated) *</span>
                  </label>
                  <input 
                    {...register("name")}
                    readOnly
                    placeholder="Select Grade, Subject & Teacher..."
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed outline-none transition-all font-bold"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Grade Level *</label>
                  {metaLoading ? (
                    <Skeleton className="w-full h-[45px] rounded-xl" />
                  ) : (
                    <select 
                      {...register("gradeId")}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      <option value="">Select Grade</option>
                      {filteredGrades.length > 0 ? filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>) : null}
                    </select>
                  )}
                  {errors.gradeId && <p className="text-xs text-red-500 ml-1 mt-1">{errors.gradeId.message}</p>}
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Subject *</label>
                  {metaLoading ? (
                    <Skeleton className="w-full h-[45px] rounded-xl" />
                  ) : (
                    <select 
                      {...register("subjectId")}
                      disabled={!watchedGradeId}
                      className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${!watchedGradeId ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60" : "bg-slate-50 text-slate-700"}`}
                    >
                      <option value="">{watchedGradeId ? "Select Subject" : "Pick Grade First"}</option>
                      {filteredSubjects.length > 0 ? filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.subjectCode})</option>) : null}
                    </select>
                  )}
                  {errors.subjectId && <p className="text-xs text-red-500 ml-1 mt-1">{errors.subjectId.message}</p>}
                </div>

                 <div className="space-y-1">
                  {!fixedTeacherId && (
                    <>
                      <label className="text-sm font-semibold text-slate-700 ml-1">Assigned Teacher *</label>
                      {metaLoading ? (
                        <Skeleton className="w-full h-[45px] rounded-xl" />
                      ) : (
                        <select 
                          {...register("teacherId")}
                          disabled={!watchedSubjectId}
                          className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${!watchedSubjectId ? "bg-slate-100 text-slate-400 cursor-not-allowed opacity-60" : "bg-slate-50 text-slate-700"}`}
                        >
                          <option value="">{watchedSubjectId ? "Select Instructor" : "Pick Subject First"}</option>
                          {filteredTeachers.length > 0 ? filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : null}
                        </select>
                      )}
                    </>
                  )}
                  {fixedTeacherId && (
                    <input type="hidden" {...register("teacherId")} />
                  )}
                  {errors.teacherId && <p className="text-xs text-red-500 ml-1 mt-1">{errors.teacherId.message}</p>}
                </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">Monthly Fee (LKR) *</label>
              <input 
                {...register("monthlyFee")}
                type="number"
                placeholder="e.g. 2500"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
              />
              {errors.monthlyFee && <p className="text-xs text-red-500 ml-1 mt-1">{errors.monthlyFee.message}</p>}
            </div>
          </div>

          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Timing & Location
                </h4>
                <button 
                  type="button"
                  onClick={() => append({ dayOfWeek: "monday", startTime: "", endTime: "", room: "" })}
                  className="px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Slot
                </button>
             </div>

             <div className="space-y-4">
               {fields.map((field, index) => (
                 <div key={field.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4 relative group">
                    {fields.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => remove(index)}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-white border border-slate-200 text-red-500 rounded-full flex items-center justify-center hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">Day *</label>
                        <select 
                          {...register(`schedules.${index}.dayOfWeek`)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                          {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => (
                            <option key={d} value={d} className="capitalize">{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">Hall / Room *</label>
                        <input 
                          {...register(`schedules.${index}.room`)}
                          placeholder="e.g. Room 101"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Start *</label>
                        <input 
                          {...register(`schedules.${index}.startTime`)}
                          type="time"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> End *</label>
                        <input 
                          {...register(`schedules.${index}.endTime`)}
                          type="time"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                 </div>
               ))}
               {errors.schedules && <p className="text-xs text-red-500 ml-1">{errors.schedules.message}</p>}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Apply Adjustment" : "Authorize Class")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
