"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, getDocs, getDoc, query, orderBy, serverTimestamp, doc, writeBatch, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, BookOpen, Calendar, Clock, Plus, Trash2, X, Settings2, ArrowRight, CreditCard, Layers, AlertTriangle } from "lucide-react";
import { Teacher, Grade, Subject, Class } from "@/types/models";
import toast from "react-hot-toast";
import { createNotification } from "@/hooks/useNotifications";

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
  sessionsPerCycle: z.coerce.number().min(1, "At least 1 session per cycle required"),
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
  const [activeTab, setActiveTab] = useState<'curriculum' | 'schedule'>('curriculum');
  const [conflicts, setConflicts] = useState<Record<number, string>>({});

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors, isValid },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema) as any,
    mode: "onChange",
    defaultValues: {
      status: "active",
      name: "",
      teacherId: fixedTeacherId || "",
      monthlyFee: 0,
      sessionsPerCycle: 8,
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
        let teachersList: Teacher[] = [];
        if (fixedTeacherId) {
          const teacherSnap = await getDoc(doc(db, "teachers", fixedTeacherId));
          if (teacherSnap.exists()) {
            teachersList = [{ id: teacherSnap.id, ...teacherSnap.data() } as Teacher];
          }
        } else {
          const snap = await getDocs(query(collection(db, "teachers"), orderBy("name", "asc")));
          teachersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher));
        }

        const [gradesSnap, subjectsSnap] = await Promise.all([
          getDocs(query(collection(db, "grades"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "subjects"), orderBy("name", "asc")))
        ]);
        
        setTeachers(teachersList);
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
      if (initialData) {
        reset({
          name: initialData.name,
          subjectId: initialData.subjectId || "",
          gradeId: initialData.gradeId || "",
          teacherId: initialData.teacherId,
          schedules: initialData.schedules || [{ dayOfWeek: "monday", startTime: "", endTime: "", room: "" }],
          status: initialData.status || "active",
          monthlyFee: initialData.monthlyFee || 0,
          sessionsPerCycle: initialData.sessionsPerCycle || 8,
        });
        setActiveTab('curriculum');
      } else {
        reset({
          name: "",
          subjectId: "",
          gradeId: "",
          teacherId: fixedTeacherId || "",
          schedules: [{ dayOfWeek: "monday", startTime: "", endTime: "", room: "" }],
          status: "active",
          monthlyFee: 0,
          sessionsPerCycle: 8,
        });
        setActiveTab('curriculum');
      }
  }, [initialData, reset, isOpen]);

  const onSubmit = async (data: ClassForm) => {
    setLoading(true);
    setConflicts({}); // Clear previous conflicts
    try {
      const classesSnap = await getDocs(collection(db, "classes"));
      const currentClasses = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));

      const hasOverlap = (s1: string, e1: string, s2: string, e2: string) => {
          return s1 < e2 && s2 < e1;
      };

      const newConflicts: Record<number, string> = {};

      for (let i = 0; i < data.schedules.length; i++) {
        for (let j = 0; j < data.schedules.length; j++) {
            if (i === j) continue;
            const slot1 = data.schedules[i];
            const slot2 = data.schedules[j];
            if (slot1.dayOfWeek.trim().toLowerCase() === slot2.dayOfWeek.trim().toLowerCase()) {
                if (hasOverlap(slot1.startTime, slot1.endTime, slot2.startTime, slot2.endTime)) {
                    newConflicts[i] = "Internal Day/Time Overlap";
                }
            }
        }
      }

      for (let i = 0; i < data.schedules.length; i++) {
          const newSlot = data.schedules[i];
          for (const existing of currentClasses) {
              if (initialData && existing.id === initialData.id) continue;
              if (existing.status !== 'active') continue;

              for (const existingSlot of (existing.schedules || [])) {
                  const sameDay = newSlot.dayOfWeek.trim().toLowerCase() === existingSlot.dayOfWeek.trim().toLowerCase();
                  if (!sameDay) continue;

                  const timeOverlap = hasOverlap(newSlot.startTime, newSlot.endTime, existingSlot.startTime, existingSlot.endTime);
                  if (!timeOverlap) continue;

                  if (newSlot.room.trim().toLowerCase() === existingSlot.room.trim().toLowerCase()) {
                      newConflicts[i] = `Room "${newSlot.room}" occupied by ${existing.name}`;
                  }

                  if (data.teacherId === existing.teacherId) {
                      newConflicts[i] = `Instructor busy with ${existing.name}`;
                  }

                  if (data.gradeId === existing.gradeId) {
                      newConflicts[i] = `Grade overlapping with ${existing.name}`;
                  }
              }
          }
      }

      if (Object.keys(newConflicts).length > 0) {
        setConflicts(newConflicts);
        toast.error("Timeline Collision Detected: Institutional resources (Teacher/Room) are overlapping. Review highlighted slots.");
        setLoading(false);
        setActiveTab('schedule');
        return;
      }

      const batch = writeBatch(db);
      const selectedTeacher = teachers.find(t => t.id === data.teacherId);
      const selectedSubject = subjects.find(s => s.id === data.subjectId);
      const selectedGrade = grades.find(g => g.id === data.gradeId);

      const sortedSchedules = [...data.schedules].sort((a, b) => {
          const dayOrder: Record<string, number> = { "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6 };
          const dayCompare = dayOrder[a.dayOfWeek.toLowerCase()] - dayOrder[b.dayOfWeek.toLowerCase()];
          if (dayCompare !== 0) return dayCompare;
          return a.startTime.localeCompare(b.startTime);
      });

      const classData = {
        ...data,
        schedules: sortedSchedules,
        teacherName: selectedTeacher?.name || "",
        subject: selectedSubject?.name || "",
        grade: selectedGrade?.name || "",
        updatedAt: serverTimestamp(),
      };

      if (initialData) {
        if (initialData.gradeId !== data.gradeId) {
          if (initialData.gradeId) batch.update(doc(db, "grades", initialData.gradeId), { classCount: increment(-1) });
          if (data.gradeId) batch.update(doc(db, "grades", data.gradeId), { classCount: increment(1) });
        }
        batch.update(doc(db, "classes", initialData.id), classData);
        await batch.commit();

        // Notify Teacher
        await createNotification({
          userId: data.teacherId,
          title: "Class Refactored",
          message: `The schedule for ${data.name} (${selectedSubject?.name}) has been updated by administration.`,
          type: "info",
          link: "/teacher/classes"
        });

        toast.success("Archive Update Successful: Class schedule has been refactored and synchronized.");
      } else {
        const classRef = doc(collection(db, "classes"));
        if (data.gradeId) batch.update(doc(db, "grades", data.gradeId), { classCount: increment(1) });
        batch.set(classRef, { ...classData, studentCount: 0, createdAt: serverTimestamp() });
        await batch.commit();

        // Notify Teacher
        await createNotification({
          userId: data.teacherId,
          title: "New Class Assigned",
          message: `You have been assigned to a new ${selectedGrade?.name} ${selectedSubject?.name} class: ${data.name}.`,
          type: "success",
          link: "/teacher/classes"
        });

        toast.success("Institutional Authorization Successful: New academic class has been registered in the terminal.");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("System Request Aborted: Failed to synchronize class configuration.");
    } finally {
      setLoading(false);
    }
  };

  const className = watch("name") || (initialData?.name || "New Class");
  const classInitials = className.charAt(0);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    <BookOpen className="w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight leading-none">
                        {initialData ? "Refactor Class Session" : "Schedule Academic Class"}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                            <Layers className="w-3.5 h-3.5" /> Registry Config
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${watch("status") === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {watch("status")}
                         </span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['curriculum', 'schedule'] as const).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab}
                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
          <form id="class-form" onSubmit={handleSubmit(onSubmit)} className="animate-in fade-in duration-500 pb-10">
            {activeTab === 'curriculum' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <Settings2 className="w-3.5 h-3.5" /> Curriculum Configuration
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="col-span-full space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Class Display Identifier</label>
                      <input {...register("name")} readOnly className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold" />
                      <p className="text-[9px] text-slate-400 italic ml-1">Auto-generated based on selection.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Grade Level</label>
                      <select {...register("gradeId")} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/10 transition-all outline-none font-medium">
                        <option value="">Select Plane</option>
                        {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      {errors.gradeId && <p className="text-[10px] text-red-500 font-bold">{errors.gradeId.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Subject</label>
                      <select {...register("subjectId")} disabled={!watchedGradeId} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-50 font-medium">
                        <option value="">{watchedGradeId ? "Select Subject" : "Pick Grade First"}</option>
                        {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.subjectCode})</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Lead Instructor</label>
                      {!fixedTeacherId ? (
                        <select {...register("teacherId")} disabled={!watchedSubjectId} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl disabled:opacity-50 font-medium">
                            <option value="">{watchedSubjectId ? "Assign Faculty" : "Pick Subject First"}</option>
                            {filteredTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      ) : (
                        <div className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500">
                            {teachers.find(t => t.id === fixedTeacherId)?.name}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Operational Status</label>
                       <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                          {["active", "inactive"].map((s) => (
                            <button key={s} type="button" onClick={() => setValue("status", s as any)} className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${watch("status") === s ? 'bg-white shadow-sm text-primary border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                                {s}
                            </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Monthly Billing (LKR)</label>
                      <div className="relative">
                        <input {...register("monthlyFee")} type="number" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                        <CreditCard className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Sessions Per Cycle</label>
                      <div className="relative">
                        <input {...register("sessionsPerCycle")} type="number" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                        <Calendar className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-6">
                     <button type="button" onClick={() => setActiveTab('schedule')} className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg">
                        Next: Schedule <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="max-w-4xl mx-auto space-y-12">
                 <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5" /> Operational Timeline
                        </h4>
                        <button type="button" onClick={() => append({ dayOfWeek: "monday", startTime: "", endTime: "", room: "" })} className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" /> Add Session Slot
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {fields.map((field, index) => {
                           const hasConflict = conflicts[index];
                           return (
                             <div 
                                key={field.id} 
                                className={`p-6 rounded-2xl border transition-all relative group animate-in slide-in-from-right-4 duration-300 ${hasConflict ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-500/20' : 'bg-slate-50 border-slate-100'}`}
                             >
                                  {hasConflict && (
                                     <div className="absolute -top-3 left-6 px-3 py-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
                                         <AlertTriangle className="w-3 h-3" /> {hasConflict}
                                     </div>
                                  )}
                                  
                                  {fields.length > 1 && (
                                      <button type="button" onClick={() => remove(index)} className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-200 text-rose-500 rounded-full flex items-center justify-center hover:bg-rose-50 transition-all shadow-md">
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  )}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5 md:col-span-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Day</label>
                                        <select {...register(`schedules.${index}.dayOfWeek`)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase transition-all">
                                            {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Start Time</label>
                                        <div className="relative">
                                            <input {...register(`schedules.${index}.startTime`)} type="time" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">End Time</label>
                                        <div className="relative">
                                            <input {...register(`schedules.${index}.endTime`)} type="time" className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Room / Hall</label>
                                        <input {...register(`schedules.${index}.room`)} placeholder="e.g. Hall A" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium" />
                                    </div>
                                </div>
                           </div>
                          );
                        })}
                    </div>
                 </div>
              </div>
            )}
          </form>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/30 z-10 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
             <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration Terminal Active</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-all">Discard</button>
            <button 
              form="class-form" 
              type="submit" 
              disabled={loading || !isValid} 
              className="flex-1 sm:flex-none px-10 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Refactor Schedule" : "Authorize Class")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
