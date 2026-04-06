"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, getDocs, orderBy, serverTimestamp, query, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, User, Phone, MapPin, GraduationCap } from "lucide-react";
import { Grade, Student, Subject } from "@/types/models";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { BookOpen } from "lucide-react";

const studentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  parentName: z.string().min(3, "Parent name is required"),
  parentPhone: z.string().min(10, "Parent phone is required"),
  schoolName: z.string().min(3, "School name is required"),
  address: z.string().min(5, "Address is required"),
  grade: z.string().min(1, "Grade is required"),
  gradeId: z.string().optional(),
  gender: z.enum(["male", "female", "other"]),
  status: z.enum(["active", "inactive"]),
  enrolledSubjects: z.array(z.string()).optional(),
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
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const gradeQuery = query(collection(db, "grades"), orderBy("name", "asc"));
        const subjectQuery = query(collection(db, "subjects"), orderBy("name", "asc"));
        
        const [gradeSnap, subjectSnap] = await Promise.all([
          getDocs(gradeQuery),
          getDocs(subjectQuery)
        ]);

        setGrades(gradeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
        setSubjects(subjectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      } catch (error) {
        console.error("Error loading form data:", error);
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
    }
  });

  const selectedGrade = watch("grade");
  const selectedSubjects = watch("enrolledSubjects") || [];

  useEffect(() => {
    const gradeObj = grades.find(g => g.name === selectedGrade);
    if (gradeObj) {
      setValue("gradeId", gradeObj.id);
    }
  }, [selectedGrade, grades, setValue]);

  // Re-sync form when initialData changes or modal opens
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        phone: initialData.phone,
        parentName: initialData.parentName,
        parentPhone: initialData.parentPhone || "",
        schoolName: initialData.schoolName,
        address: initialData.address,
        grade: initialData.grade || "",
        gradeId: initialData.gradeId || "",
        gender: initialData.gender || "male",
        status: initialData.status,
        enrolledSubjects: initialData.enrolledSubjects || [],
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
      });
    }
  }, [initialData, reset, isOpen]);

  const onSubmit = async (data: StudentForm) => {
    setLoading(true);
    try {
      if (initialData) {
        // Update
        const studentRef = doc(db, "students", initialData.id);
        await updateDoc(studentRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast.success("Student profile updated!");
      } else {
        // Create
        await addDoc(collection(db, "students"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast.success("Student successfully registered!");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error(`Error: ${initialData ? 'Update' : 'Creation'} failed.`);
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
                  <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
                  <input 
                    {...register("name")}
                    placeholder="e.g. Ruwan Kumara"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Phone Number</label>
                  <input 
                    {...register("phone")}
                    placeholder="e.g. 0771234567"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.phone && <p className="text-xs text-red-500 ml-1 mt-1">{errors.phone.message}</p>}
                </div>

                <div className="space-y-1 col-span-full">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Gender</label>
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
                   <label className="text-sm font-semibold text-slate-700 ml-1">Grade / Level</label>
                   <select 
                     {...register("grade")}
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                   >
                     <option value="">Select Grade</option>
                     {grades.length > 0 ? grades.map(g => (
                       <option key={g.id} value={g.name}>{g.name}</option>
                     )) : null}
                   </select>
                   {grades.length === 0 && (
                     <p className="text-[10px] text-amber-600 mt-1 ml-1 flex items-center gap-1">
                       No grades found. <a href="/admin/grades" className="underline font-bold">Add One</a>
                     </p>
                   )}
                   {errors.grade && <p className="text-xs text-red-500 ml-1 mt-1">{errors.grade.message}</p>}
                </div>

                <div className="space-y-1">
                   <label className="text-sm font-semibold text-slate-700 ml-1">School Name</label>
                   <input 
                     {...register("schoolName")}
                     placeholder="e.g. Royal College"
                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                   />
                   {errors.schoolName && <p className="text-xs text-red-500 ml-1 mt-1">{errors.schoolName.message}</p>}
                </div>
             </div>

             {/* Subject Selection */}
             <div className="space-y-2 mt-4">
                <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
                   <BookOpen className="w-3.5 h-3.5 text-primary/60" /> Enrolled Subjects
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                   {subjects.map(subject => (
                     <label 
                       key={subject.id} 
                       className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                         selectedSubjects.includes(subject.id) 
                         ? 'bg-primary/10 border-primary/30 text-primary font-bold' 
                         : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                       }`}
                     >
                       <input 
                         type="checkbox"
                         value={subject.id}
                         className="hidden"
                         checked={selectedSubjects.includes(subject.id)}
                         onChange={(e) => {
                           const val = e.target.value;
                           const updated = e.target.checked 
                             ? [...selectedSubjects, val]
                             : selectedSubjects.filter(i => i !== val);
                           setValue("enrolledSubjects", updated);
                         }}
                       />
                       <span className="text-xs uppercase tracking-tight">{subject.name}</span>
                     </label>
                   ))}
                   {subjects.length === 0 && (
                     <p className="text-[10px] text-slate-400 italic">No subjects available.</p>
                   )}
                </div>
                {errors.enrolledSubjects && <p className="text-xs text-red-500 ml-1 mt-1">{errors.enrolledSubjects.message}</p>}
             </div>
          </div>

          {/* Parent Info */}
          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
             <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <Phone className="w-3 h-3" /> Guardian Details
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Parent/Guardian Name</label>
                  <input 
                    {...register("parentName")}
                    placeholder="e.g. Mr. S. Kumara"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.parentName && <p className="text-xs text-red-500 ml-1 mt-1">{errors.parentName.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Guardian Phone</label>
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
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Current Address
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
