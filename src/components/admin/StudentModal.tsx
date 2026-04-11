"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, getDocs, orderBy, serverTimestamp, query, doc, increment, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, User, Phone, MapPin, GraduationCap, BookOpen } from "lucide-react";
import { Grade, Student, Class } from "@/types/models";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { generateId } from "@/lib/id-generator";
import Skeleton from "@/components/ui/Skeleton";

const studentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  phone: z.string().optional(),
  parentName: z.string().min(3, "Parent name is required"),
  parentPhone: z.string().min(10, "Parent phone number is required"),
  schoolName: z.string().min(3, "School name is required"),
  address: z.string().min(5, "Address is required"),
  grade: z.string().min(1, "Grade is required"),
  gradeId: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  status: z.enum(["active", "inactive"]),
  enrolledSubjects: z.array(z.string()).optional(),
  enrolledClasses: z.array(z.string()).optional(),
});

type StudentForm = z.infer<typeof studentSchema>;

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Student | null;
  isReadOnly?: boolean;
  teacherId?: string;
}

export default function StudentModal({ isOpen, onClose, onSuccess, initialData, isReadOnly, teacherId }: StudentModalProps) {
  const [loading, setLoading] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [availableClasses, setAvailableClasses] = useState<Class[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [fetchingClasses, setFetchingClasses] = useState(false);
  const isInitializing = useRef(false);

  useEffect(() => {
    async function loadData() {
      setMetaLoading(true);
      try {
        const gradeQuery = query(collection(db, "grades"), orderBy("name", "asc"));
        const gradeSnap = await getDocs(gradeQuery);
        setGrades(gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
      } catch (error) {
        console.error("Error loading form data:", error);
      } finally {
        setMetaLoading(false);
      }
    }
    if (isOpen) loadData();
  }, [isOpen]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      status: "active",
      gender: "male",
      enrolledSubjects: [],
      enrolledClasses: [],
    }
  });

  const selectedGrade = watch("grade");
  const selectedClassIds = watch("enrolledClasses") || [];

  useEffect(() => {
    const gradeObj = grades.find(g => g.name === selectedGrade);
    
    // Clear classes if the grade changes, BUT NOT during initial modal population
    if (!isInitializing.current && selectedGrade) {
      setValue("enrolledClasses", []);
    }

    if (gradeObj) {
      setValue("gradeId", gradeObj.id);
      loadClasses(gradeObj.id);
    } else {
      setAvailableClasses([]);
    }
  }, [selectedGrade, grades, setValue]);

  const loadClasses = async (gradeId: string) => {
    setFetchingClasses(true);
    try {
      const q = query(collection(db, "classes"), orderBy("name", "asc"));
      const snap = await getDocs(q);
      let all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      
      // Filter by Grade
      all = all.filter(c => c.gradeId === gradeId);

      // If teacherId is present, filter classes to only those handled by this teacher
      // for the EDIT side (so they can't toggle others' classes),
      // but for VIEW side we might want to show them? 
      // User said: "teacher can be edi the student details and the own subjects only"
      // and "teacher cant edit the students other classes or other subjects that not theirs"
      setAvailableClasses(all);
    } catch (error) {
      console.error("Error loading classes:", error);
    } finally {
      setFetchingClasses(false);
    }
  };

  // Coordinate data loading and form initialization
  useEffect(() => {
    if (!isOpen) {
      setAvailableClasses([]);
      return;
    }

    if (grades.length > 0) {
      isInitializing.current = true;
      if (initialData) {
        let resolvedGrade = initialData.grade || "";
        if (!resolvedGrade && initialData.gradeId) {
          resolvedGrade = grades.find(g => g.id === initialData.gradeId)?.name || "";
        }

        reset({
          name: initialData.name || "",
          phone: initialData.phone || "",
          parentName: initialData.parentName || "",
          parentPhone: initialData.parentPhone || "",
          schoolName: initialData.schoolName || "",
          address: initialData.address || "",
          grade: resolvedGrade,
          gradeId: initialData.gradeId || "",
          gender: initialData.gender || "male",
          status: initialData.status || "active",
          enrolledSubjects: initialData.enrolledSubjects || [],
          enrolledClasses: initialData.enrolledClasses || [],
        });
      } else {
        reset({
          name: "",
          phone: "",
          parentName: "",
          parentPhone: "",
          schoolName: "",
          address: "",
          grade: "",
          gradeId: "",
          gender: "male",
          status: "active",
          enrolledSubjects: [],
          enrolledClasses: [],
        });
      }
      
      setTimeout(() => {
        isInitializing.current = false;
      }, 100);
    }
  }, [initialData, reset, isOpen, grades]);

  const onSubmit = async (data: StudentForm) => {
    if (isReadOnly) return;
    setLoading(true);
    const batch = writeBatch(db);
    try {
      // Uniqueness check
      const dupQuery = query(
        collection(db, "students"), 
        where("name", "==", data.name),
        where("parentPhone", "==", data.parentPhone)
      );
      const dupSnap = await getDocs(dupQuery);
      const isDuplicate = dupSnap.docs.some(doc => initialData ? doc.id !== initialData.id : true);
      
      if (isDuplicate) {
        toast.error("Student profile already exists with these details.");
        setLoading(false);
        return;
      }

      // Handle Teacher Permission Logic
      let finalEnrolledClasses = data.enrolledClasses || [];
      let finalEnrolledSubjects = data.enrolledSubjects || [];

      if (teacherId && initialData) {
        const currentTeachersClasses = availableClasses.filter(c => c.teacherId === teacherId).map(c => c.id);
        const othersClasses = (initialData.enrolledClasses || []).filter(cid => !currentTeachersClasses.includes(cid));
        const teachersSelectedClasses = (data.enrolledClasses || []).filter(cid => currentTeachersClasses.includes(cid));
        finalEnrolledClasses = Array.from(new Set([...teachersSelectedClasses, ...othersClasses]));
        
        const teachersSubjectsInGrade = new Set(availableClasses.filter(c => c.teacherId === teacherId).map(c => c.subjectId));
        const othersSubjectsFromBefore = (initialData.enrolledSubjects || []).filter(sid => !teachersSubjectsInGrade.has(sid));
        const newSubjectsFromTeacher = new Set<string>();
        availableClasses.filter(c => c.teacherId === teacherId && teachersSelectedClasses.includes(c.id)).forEach(c => newSubjectsFromTeacher.add(c.subjectId));
        
        finalEnrolledSubjects = Array.from(new Set([...Array.from(newSubjectsFromTeacher), ...othersSubjectsFromBefore]));
      } else if (!teacherId) {
        const subjectsSet = new Set<string>();
        availableClasses.forEach(c => {
          if (data.enrolledClasses?.includes(c.id)) {
            subjectsSet.add(c.subjectId);
          }
        });
        finalEnrolledSubjects = Array.from(subjectsSet);
        finalEnrolledClasses = data.enrolledClasses || [];
      }
      
      data.enrolledClasses = finalEnrolledClasses;
      data.enrolledSubjects = finalEnrolledSubjects;

      if (initialData) {
        const studentRef = doc(db, "students", initialData.id);
        if (initialData.gradeId !== data.gradeId) {
          if (initialData.gradeId) batch.update(doc(db, "grades", initialData.gradeId), { studentCount: increment(-1) });
          if (data.gradeId) batch.update(doc(db, "grades", data.gradeId), { studentCount: increment(1) });
        }

        const diff = (old: string[], newArr: string[]) => ({
            left: old.filter(x => !newArr.includes(x)),
            joined: newArr.filter(x => !old.includes(x))
        });

        const classDiff = diff(initialData.enrolledClasses || [], data.enrolledClasses || []);
        classDiff.left.forEach(cid => batch.update(doc(db, "classes", cid), { studentCount: increment(-1) }));
        classDiff.joined.forEach(cid => batch.update(doc(db, "classes", cid), { studentCount: increment(1) }));

        const subDiff = diff(initialData.enrolledSubjects || [], data.enrolledSubjects || []);
        subDiff.left.forEach(sid => batch.update(doc(db, "subjects", sid), { studentCount: increment(-1) }));
        subDiff.joined.forEach(sid => batch.update(doc(db, "subjects", sid), { studentCount: increment(1) }));

        batch.update(studentRef, {
          ...data,
          studentId: initialData.studentId || await generateId("student"),
          updatedAt: serverTimestamp(),
        });
        
        await batch.commit();
        toast.success("Profile updated successfully.");
      } else {
        const studentRef = doc(collection(db, "students"));
        const studentId = await generateId("student");
        if (data.gradeId) batch.update(doc(db, "grades", data.gradeId), { studentCount: increment(1) });
        data.enrolledClasses?.forEach(cid => batch.update(doc(db, "classes", cid), { studentCount: increment(1) }));
        data.enrolledSubjects?.forEach(sid => batch.update(doc(db, "subjects", sid), { studentCount: increment(1) }));

        batch.set(studentRef, {
          ...data,
          studentId,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        toast.success("Student registered.");
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error(`System error during data persistence.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={isReadOnly ? "View Admissions Record" : (initialData ? "Update Institutional Record" : "Register Student")}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Identity */}
          <div className="space-y-4 col-span-full">
             <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Core Identity
                </h4>
                {initialData && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">ID:</span>
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded italic">{initialData.studentId}</span>
                    </div>
                )}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Full Name</label>
                  <input 
                    {...register("name")}
                    disabled={isReadOnly}
                    placeholder="e.g. Ruwan Kumara"
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:bg-slate-100/50 disabled:cursor-not-allowed font-bold text-slate-800"
                  />
                  {errors.name && <p className="text-[10px] text-red-500 ml-1 mt-1 font-bold">{errors.name.message}</p>}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Direct Phone</label>
                  <input 
                    {...register("phone")}
                    disabled={isReadOnly}
                    placeholder="e.g. 0771234567"
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:bg-slate-100/50 disabled:cursor-not-allowed font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Gender</label>
                  <div className="flex gap-4 mt-1">
                    {["male", "female", "other"].map((g) => (
                      <label key={g} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${watch("gender") === g ? 'bg-indigo-50 border-indigo-200' : 'bg-transparent border-transparent opacity-60'} ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input 
                          type="radio" 
                          disabled={isReadOnly}
                          value={g} 
                          {...register("gender")}
                          className="w-3.5 h-3.5 text-primary focus:ring-primary-dark border-slate-300 transition-all disabled:cursor-not-allowed"
                        />
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest capitalize">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Admission Status</label>
                    <div className="flex gap-4 mt-1">
                        {["active", "inactive"].map((s) => (
                            <label key={s} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${watch("status") === s ? (s === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200') : 'bg-transparent border-transparent opacity-60'} ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                                <input 
                                    type="radio" 
                                    disabled={isReadOnly}
                                    value={s} 
                                    {...register("status")}
                                    className="w-3.5 h-3.5 text-primary focus:ring-primary-dark border-slate-300 transition-all disabled:cursor-not-allowed"
                                />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${watch("status") === s ? (s === 'active' ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-700'}`}>{s}</span>
                            </label>
                        ))}
                    </div>
                </div>
             </div>
          </div>

          {/* Academic Profile */}
          <div className="space-y-4 col-span-full pt-6 border-t border-slate-100/50">
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 flex items-center gap-2 mb-2">
                <GraduationCap className="w-3.5 h-3.5" /> Academic Profile
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Classification</label>
                    {metaLoading ? <Skeleton className="w-full h-[52px] rounded-2xl" /> : (
                      <select 
                        {...register("grade")}
                        disabled={isReadOnly || (!!teacherId && !!initialData)}
                        className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:bg-slate-100/50 disabled:cursor-not-allowed font-bold text-slate-800 appearance-none"
                      >
                        <option value="">Select Level</option>
                        {grades.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                      </select>
                    )}
                    {!!teacherId && !!initialData && (
                      <p className="text-[10px] text-slate-400 mt-1 ml-1">Grade level is managed by administration.</p>
                    )}
                </div>

                <div className="space-y-1.5">
                   <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Current Schooling</label>
                   <input 
                     {...register("schoolName")}
                     disabled={isReadOnly}
                     placeholder="Official school name"
                     className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:bg-slate-100/50 disabled:cursor-not-allowed font-bold text-slate-800"
                   />
                </div>
             </div>

             {/* Class Enrollment */}
             <div className="space-y-4 mt-6">
                <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-widest flex items-center justify-between">
                   <span>Session Subscriptions</span>
                   {fetchingClasses && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </label>
                
                {!selectedGrade ? (
                  <div className="py-12 border-2 border-dashed border-slate-100 rounded-[2rem] text-center">
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Select grade to visualize sessions</p>
                  </div>
                ) : availableClasses.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-slate-100 rounded-[2rem] text-center italic text-slate-400 text-xs">
                    No active sessions found for this classification.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {availableClasses.map(cls => {
                      const isEnrolled = selectedClassIds.includes(cls.id);
                      const isOthersClass = !!(teacherId && cls.teacherId !== teacherId);
                      const isDisabled = !!(isReadOnly || isOthersClass);

                      return (
                        <label 
                          key={cls.id} 
                          className={`flex items-center justify-between p-5 rounded-[1.5rem] border transition-all ${isDisabled ? 'cursor-default' : 'cursor-pointer'} group ${
                            isEnrolled 
                            ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                            : 'bg-white border-slate-100'
                          } ${!isDisabled && !isEnrolled ? 'hover:border-slate-200' : ''} ${isOthersClass ? 'opacity-50 grayscale' : ''}`}
                        >
                          <div className="flex items-center gap-5">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${isEnrolled ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                              <BookOpen className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`font-black text-sm uppercase tracking-tight ${isEnrolled ? 'text-indigo-900' : 'text-slate-700'}`}>{cls.name}</p>
                                {isOthersClass && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">Restricted Access</span>}
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {cls.subject} • {cls.teacherName || 'Faculty Assigned'}
                              </p>
                            </div>
                          </div>
                          <input 
                            type="checkbox"
                            disabled={isDisabled}
                            className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500/20 transition-all disabled:cursor-not-allowed"
                            checked={isEnrolled}
                            onChange={(e) => {
                              const updated = e.target.checked 
                                ? [...selectedClassIds, cls.id]
                                : selectedClassIds.filter(i => i !== cls.id);
                              setValue("enrolledClasses", updated, { shouldValidate: true });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
             </div>
          </div>

          {/* Logistics */}
          <div className="space-y-4 col-span-full pt-6 border-t border-slate-100/50">
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 flex items-center gap-2 mb-2">
                <Phone className="w-3.5 h-3.5" /> Emergency Contacts
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Guardian Name</label>
                  <input 
                    {...register("parentName")}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:bg-slate-100/50 disabled:cursor-not-allowed font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider">Guardian Hotline</label>
                  <input 
                    {...register("parentPhone")}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all disabled:bg-slate-100/50 disabled:cursor-not-allowed font-bold text-slate-800"
                  />
                </div>
             </div>
             <div className="space-y-1.5 pt-4">
               <label className="text-xs font-black text-slate-500 ml-1 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-300" /> Physical Address
               </label>
               <textarea 
                  {...register("address")}
                  disabled={isReadOnly}
                  rows={2}
                  className="w-full px-4 py-4 bg-slate-50/50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none disabled:bg-slate-100/50 disabled:cursor-not-allowed font-semibold text-slate-700"
               ></textarea>
             </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-8 border-t border-slate-100 flex-col sm:flex-row">
          <button 
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-10 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
          >
            {isReadOnly ? "Close View" : "Cancel"}
          </button>
          {!isReadOnly && (
            <button 
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-12 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Commit Changes"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
