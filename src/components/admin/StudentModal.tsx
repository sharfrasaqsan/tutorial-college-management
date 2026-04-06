"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, getDocs, orderBy, serverTimestamp, query, doc, increment, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, User, Phone, MapPin, GraduationCap } from "lucide-react";
import { Grade, Student, Class } from "@/types/models";
import Modal from "@/components/ui/Modal";
import { BookOpen } from "lucide-react";
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
}

export default function StudentModal({ isOpen, onClose, onSuccess, initialData }: StudentModalProps) {
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
      // We filter manually to avoid complex index requirements for simple queries if possible, 
      // but usually where("gradeId", "==", gradeId) is better.
      const snap = await getDocs(q);
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setAvailableClasses(all.filter(c => c.gradeId === gradeId));
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

    // Only populate form once we have the grades to avoid dropdown reset issues
    if (grades.length > 0) {
      isInitializing.current = true; // Mark that we are populating
      if (initialData) {
        // Handle legacy data where grade name might be missing but ID exists
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
      
      // Allow the next effect cycle to handle clearing classes on user changes
      setTimeout(() => {
        isInitializing.current = false;
      }, 100);
    }
  }, [initialData, reset, isOpen, grades]);

  const onSubmit = async (data: StudentForm) => {
    setLoading(true);
    const batch = writeBatch(db);
    try {
      // Derive subjects from selected classes
      // If availableClasses is empty but we have enrolledClasses (still loading), 
      // we must preserve existing subjects to prevent wiping data.
      let finalEnrolledSubjects = data.enrolledSubjects || [];
      
      if (availableClasses.length > 0) {
        const subjectsSet = new Set<string>();
        availableClasses.forEach(c => {
          if (data.enrolledClasses?.includes(c.id)) {
            subjectsSet.add(c.subjectId);
          }
        });
        finalEnrolledSubjects = Array.from(subjectsSet);
      }
      
      data.enrolledSubjects = finalEnrolledSubjects;

      if (initialData) {
        // Update Case
        const studentRef = doc(db, "students", initialData.id);
        
        // 1. Handle Grade Change
        if (initialData.gradeId !== data.gradeId) {
          if (initialData.gradeId) {
            batch.update(doc(db, "grades", initialData.gradeId), { studentCount: increment(-1) });
          }
          if (data.gradeId) {
            batch.update(doc(db, "grades", data.gradeId), { studentCount: increment(1) });
          }
        }

        // 2. Handle Class Enrollment Changes
        const oldClasses = initialData.enrolledClasses || [];
        const newClasses = data.enrolledClasses || [];
        
        const classesLeft = oldClasses.filter(x => !newClasses.includes(x));
        const classesJoined = newClasses.filter(x => !oldClasses.includes(x));

        classesLeft.forEach(cid => {
          batch.update(doc(db, "classes", cid), { studentCount: increment(-1) });
        });
        classesJoined.forEach(cid => {
          batch.update(doc(db, "classes", cid), { studentCount: increment(1) });
        });

        // 3. Handle Subject Enrollment Changes (Unique Subject Count)
        const oldSubjects = initialData.enrolledSubjects || [];
        const newSubjects = data.enrolledSubjects || [];
        
        const subjectsLeft = oldSubjects.filter(x => !newSubjects.includes(x));
        const subjectsJoined = newSubjects.filter(x => !oldSubjects.includes(x));

        subjectsLeft.forEach(sid => {
          batch.update(doc(db, "subjects", sid), { studentCount: increment(-1) });
        });
        subjectsJoined.forEach(sid => {
          batch.update(doc(db, "subjects", sid), { studentCount: increment(1) });
        });

        // 4. Update Student Document
        batch.update(studentRef, {
          ...data,
          studentId: initialData.studentId || await generateId("student"),
          updatedAt: serverTimestamp(),
        });
        
        await batch.commit();
        toast.success("Student profile updated!");
      } else {
        // Create Case
        const studentRef = doc(collection(db, "students"));
        await generateId("student"); // Generate for side effects if any, but we use it in the data below
        
        // 1. Grade Count
        if (data.gradeId) {
          batch.update(doc(db, "grades", data.gradeId), { studentCount: increment(1) });
        }

        // 2. Class Counts
        data.enrolledClasses?.forEach(cid => {
          batch.update(doc(db, "classes", cid), { studentCount: increment(1) });
        });

        // 3. Subject Counts
        data.enrolledSubjects?.forEach(sid => {
          batch.update(doc(db, "subjects", sid), { studentCount: increment(1) });
        });

        // 4. Create Student
        batch.set(studentRef, {
          ...data,
          studentId: await generateId("student"),
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        toast.success("Student successfully registered!");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error(`Error: Enrollment processing failed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={initialData ? "Modify Student Profile" : "Register New Student"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="space-y-4 col-span-full">
             <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <User className="w-3 h-3" /> Basic Information
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Full Name *</label>
                  <input 
                    {...register("name")}
                    placeholder="e.g. Ruwan Kumara"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1 flex justify-between items-center">
                    Student Phone <span className="text-[10px] text-slate-400 font-normal uppercase">(Optional)</span>
                  </label>
                  <input 
                    {...register("phone")}
                    placeholder="e.g. 0771234567"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.phone && <p className="text-xs text-red-500 ml-1 mt-1">{errors.phone.message}</p>}
                </div>

                <div className="space-y-1 col-span-full">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Gender *</label>
                  <div className="flex gap-4 mt-1">
                    {["male", "female", "other"].map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="radio" 
                          value={g} 
                          {...register("gender")}
                          className="w-4 h-4 text-primary focus:ring-primary-dark border-slate-300 transition-all cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-primary transition-colors capitalize">{g}</span>
                      </label>
                    ))}
                  </div>
                  {errors.gender && <p className="text-xs text-red-500 ml-1 mt-1">{errors.gender.message}</p>}
                </div>
             </div>
          </div>

          {/* Academic Info */}
          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
             <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <GraduationCap className="w-3 h-3" /> Academic & Region
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-sm font-semibold text-slate-700 ml-1">Grade / Level *</label>
                    {metaLoading ? (
                      <Skeleton className="w-full h-[45px] rounded-xl" />
                    ) : (
                      <select 
                        {...register("grade")}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      >
                        <option value="">Select Grade</option>
                        {grades.map(g => (
                          <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                      </select>
                    )}
                    {!metaLoading && grades.length === 0 && (
                      <p className="text-[10px] text-amber-600 mt-1 ml-1 flex items-center gap-1">
                        No grades found. <a href="/admin/grades" className="underline font-bold">Add One</a>
                      </p>
                    )}
                    {errors.grade && <p className="text-xs text-red-500 ml-1 mt-1">{errors.grade.message}</p>}
                </div>

                <div className="space-y-1">
                   <label className="text-sm font-semibold text-slate-700 ml-1">School Name *</label>
                   <input 
                     {...register("schoolName")}
                     placeholder="e.g. Royal College"
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                   />
                   {errors.schoolName && <p className="text-xs text-red-500 ml-1 mt-1">{errors.schoolName.message}</p>}
                </div>
             </div>

             {/* Class Selection */}
             <div className="space-y-3 mt-4">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-primary/60" /> Class Enrollment *
                   </div>
                   {fetchingClasses && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </label>
                
                {!selectedGrade ? (
                  <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                    <p className="text-xs text-slate-400">Please select a grade above to view available classes.</p>
                  </div>
                ) : fetchingClasses ? (
                  <div className="space-y-2">
                     {[1,2].map(i => <Skeleton key={i} className="w-full h-20 rounded-2xl" />)}
                  </div>
                ) : availableClasses.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                    <p className="text-xs text-slate-400">No classes scheduled for this grade yet.</p>
                    <a href="/admin/classes" className="text-[10px] text-primary font-bold uppercase hover:underline mt-2 block">Schedule a Class</a>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {availableClasses.map(cls => (
                      <label 
                        key={cls.id} 
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
                          selectedClassIds.includes(cls.id) 
                          ? 'bg-primary/5 border-primary shadow-sm' 
                          : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${selectedClassIds.includes(cls.id) ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${selectedClassIds.includes(cls.id) ? 'text-primary' : 'text-slate-700'}`}>{cls.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{cls.subject} • {cls.dayOfWeek}s</p>
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          className="w-5 h-5 rounded-lg border-slate-200 text-primary focus:ring-primary/20 transition-all cursor-pointer"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={(e) => {
                            const val = cls.id;
                            const updated = e.target.checked 
                              ? [...selectedClassIds, val]
                              : selectedClassIds.filter(i => i !== val);
                            setValue("enrolledClasses", updated, { shouldValidate: true });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
                {errors.enrolledClasses && <p className="text-xs text-red-500 ml-1 mt-1">{errors.enrolledClasses.message}</p>}
             </div>
          </div>

          {/* Parent Info */}
          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
             <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <Phone className="w-3 h-3" /> Guardian Details
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Parent/Guardian Name *</label>
                  <input 
                    {...register("parentName")}
                    placeholder="e.g. Mr. S. Kumara"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.parentName && <p className="text-xs text-red-500 ml-1 mt-1">{errors.parentName.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Guardian Phone *</label>
                  <input 
                    {...register("parentPhone")}
                    placeholder="e.g. 0712345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.parentPhone && <p className="text-xs text-red-500 ml-1 mt-1">{errors.parentPhone.message}</p>}
                </div>
             </div>
          </div>

          {/* Address & Misc */}
          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
             <div className="space-y-1">
               <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Current Address *
               </label>
               <textarea 
                  {...register("address")}
                  rows={2}
                  placeholder="Street name, City, Zip"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
               ></textarea>
               {errors.address && <p className="text-xs text-red-500 ml-1 mt-1">{errors.address.message}</p>}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Update Record" : "Complete Registration")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
