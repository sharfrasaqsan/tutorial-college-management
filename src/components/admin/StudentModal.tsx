"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, getDocs, orderBy, serverTimestamp, query, doc, increment, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, User, Phone, MapPin, GraduationCap, BookOpen, X, School, CheckCircle, Activity, Hash, ArrowRight } from "lucide-react";
import { Grade, Student, Class } from "@/types/models";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { generateId } from "@/lib/id-generator";
import Skeleton from "@/components/ui/Skeleton";
import { format } from "date-fns";

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
  admissionFee: z.coerce.number().min(0).optional(),
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
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'logistics'>('overview');

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
    formState: { errors, isValid },
  } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema) as any,
    mode: "onChange",
    defaultValues: {
      status: "active",
      gender: "male",
      enrolledSubjects: [],
      enrolledClasses: [],
      admissionFee: 500,
    }
  });

  const selectedGrade = watch("grade");
  const selectedClassIds = watch("enrolledClasses") || [];

  useEffect(() => {
    const gradeObj = grades.find(g => g.name === selectedGrade);
    
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

  async function loadClasses(gradeId: string) {
    setFetchingClasses(true);
    try {
      const q = query(collection(db, "classes"), where("gradeId", "==", gradeId));
      const snap = await getDocs(q);
      setAvailableClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingClasses(false);
    }
  }

  useEffect(() => {
    setActiveTab('overview');
    if (initialData) {
      isInitializing.current = true;
      reset({
        name: initialData.name,
        phone: initialData.phone,
        parentName: initialData.parentName,
        parentPhone: initialData.parentPhone,
        schoolName: initialData.schoolName,
        address: initialData.address,
        grade: initialData.grade,
        gradeId: initialData.gradeId,
        gender: initialData.gender,
        status: initialData.status,
        enrolledClasses: initialData.enrolledClasses || [],
        enrolledSubjects: initialData.enrolledSubjects || [],
      });
      setTimeout(() => {
        isInitializing.current = false;
      }, 500);
    } else {
      reset({
        name: "",
        phone: "",
        parentPhone: "",
        parentName: "",
        schoolName: "",
        address: "",
        grade: "",
        gradeId: "",
        gender: "male",
        status: "active",
        enrolledClasses: [],
        enrolledSubjects: [],
        admissionFee: 500,
      });
    }
  }, [initialData, reset, isOpen]);

  const onSubmit = async (data: StudentForm) => {
    setLoading(true);
    const batch = writeBatch(db);
    try {
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
        toast.success("Student updated successfully.");
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

        // 3. Create Admission Fee Payment Record if applicable
        if ((data.admissionFee || 0) > 0) {
          const paymentRef = doc(collection(db, "payments"));
          batch.set(paymentRef, {
            studentId: studentId, // Use the generated ID
            studentName: data.name,
            amount: data.admissionFee || 0,
            month: format(new Date(), "MMMM"),
            method: "cash",
            description: "Institutional Admission Fee",
            status: "paid",
            subject: "Admission",
            createdAt: serverTimestamp(),
          });
        }

        await batch.commit();
        toast.success("Student added successfully.");
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving student:", error);
      toast.error("Error: Could not save student.");
    } finally {
      setLoading(false);
    }
  };

  const studentName = watch("name") || (initialData?.name || "New Student");
  const studentInitials = studentName.charAt(0).toUpperCase();

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {studentInitials}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {initialData ? "Edit Student" : "Add Student"}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> {initialData?.studentId || "PENDING"}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${watch("status") === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {watch("status")}
                         </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['overview', 'academics', 'logistics'] as const).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab === 'overview' ? 'Info' : tab === 'academics' ? 'Classes' : 'Contact'}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all" />
                    )}
                </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
          <form id="student-form" onSubmit={handleSubmit(onSubmit as any)} className="animate-in fade-in duration-500 pb-10">
            {activeTab === 'overview' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <User className="w-3.5 h-3.5" /> Basic Info
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Student Name</label>
                      <input {...register("name")} placeholder="Full Name" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-700" />
                      {errors.name && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Student Phone (Optional)</label>
                       <div className="relative">
                          <input {...register("phone")} placeholder="07XXXXXXXX" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                          <Phone className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Parent / Guardian Name</label>
                       <input {...register("parentName")} placeholder="Father or Mother's Name" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                       {errors.parentName && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.parentName.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Emergency Contact No.</label>
                       <div className="relative">
                          <input {...register("parentPhone")} placeholder="07XXXXXXXX" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                          <Phone className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                       {errors.parentPhone && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.parentPhone.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Gender</label>
                      <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-full">
                        {["male", "female", "other"].map((g) => (
                          <button key={g} type="button" onClick={() => setValue("gender", g as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold capitalize transition-all ${watch("gender") === g ? 'bg-white shadow-sm text-primary border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">School Name</label>
                       <div className="relative">
                          <input {...register("schoolName")} placeholder="Current School" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                          <School className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                       {errors.schoolName && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.schoolName.message}</p>}
                    </div>
                  </div>

                  <div className="flex justify-end pt-6">
                     <button
                        type="button"
                        onClick={() => setActiveTab('academics')}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg"
                     >
                        Next: Academics <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'academics' && (
              <div className="max-w-4xl mx-auto space-y-12">
                 <div className="space-y-8">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                       <GraduationCap className="w-3.5 h-3.5" /> Grade and Classes
                    </h4>
                    
                    <div className="space-y-6">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Grade</label>
                       <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                          {metaLoading ? (
                            Array(5).fill(0).map((_, i) => <Skeleton key={i} height="50px" className="rounded-xl" />)
                          ) : grades.map(g => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => setValue("grade", g.name)}
                              className={`p-4 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all text-center ${selectedGrade === g.name ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                            >
                              {g.name}
                            </button>
                          ))}
                       </div>
                       {errors.grade && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.grade.message}</p>}
                    </div>

                    {selectedGrade && (
                       <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Classes</label>
                          {fetchingClasses ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <Skeleton height="80px" className="rounded-2xl" />
                               <Skeleton height="80px" className="rounded-2xl" />
                            </div>
                          ) : availableClasses.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {availableClasses.map(cls => (
                                 <button
                                   key={cls.id}
                                   type="button"
                                   onClick={() => {
                                      const current = [...selectedClassIds];
                                      const idx = current.indexOf(cls.id);
                                      if (idx > -1) current.splice(idx, 1);
                                      else current.push(cls.id);
                                      setValue("enrolledClasses", current);
                                   }}
                                   className={`p-5 rounded-2xl border text-left transition-all relative ${selectedClassIds.includes(cls.id) ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                 >
                                    <h5 className={`font-bold text-sm ${selectedClassIds.includes(cls.id) ? 'text-white' : 'text-slate-800'}`}>{cls.name}</h5>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${selectedClassIds.includes(cls.id) ? 'text-slate-400' : 'text-slate-400'}`}>{cls.subject} • {cls.teacherName || 'Faculty'}</p>
                                    {selectedClassIds.includes(cls.id) && <CheckCircle className="absolute top-4 right-4 w-5 h-5 text-emerald-400" />}
                                 </button>
                               ))}
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-slate-400 italic">No classes available for this grade level.</p>
                          )}
                       </div>
                    )}
                 </div>

                 <div className="flex justify-end pt-6">
                    <button
                       type="button"
                       onClick={() => setActiveTab('logistics')}
                       className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg"
                    >
                       Next: Contact Info <ArrowRight className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            )}

            {activeTab === 'logistics' && (
               <div className="max-w-4xl mx-auto space-y-12">
                  <div className="space-y-8">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                       <MapPin className="w-3.5 h-3.5" /> Contact Information
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                       <div className="col-span-full space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Home Address</label>
                          <textarea {...register("address")} rows={4} placeholder="Full Home Address" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium text-slate-700 resize-none pt-4" />
                          {errors.address && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.address.message}</p>}
                       </div>

                       {!initialData && (
                        <div className="col-span-full space-y-1.5 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                           <div className="flex items-center justify-between mb-2">
                             <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider ml-1">Admission Fee (Settled on Reg)</label>
                             <span className="text-[10px] font-black text-indigo-400 bg-white px-2 py-0.5 rounded border border-indigo-100">Standard Rate: LKR 500</span>
                           </div>
                           <div className="relative">
                             <input 
                               type="number" 
                               {...register("admissionFee")} 
                               className="w-full pl-12 pr-5 py-3.5 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800" 
                             />
                             <div className="absolute left-4.5 top-1/2 -translate-y-1/2 text-sm font-black text-indigo-300">LKR</div>
                           </div>
                           <p className="text-[9px] font-medium text-slate-400 mt-2 italic px-1">Generating this record will automatically append a paid transaction to the student's financial ledger.</p>
                        </div>
                       )}

                       <div className="col-span-full space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Student Status</label>
                          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-full">
                            {["active", "inactive"].map((s) => (
                              <button key={s} type="button" onClick={() => setValue("status", s as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${watch("status") === s ? (s === 'active' ? 'bg-slate-900 text-white shadow-md' : 'bg-rose-500 text-white shadow-md') : 'text-slate-400 hover:text-slate-600'}`}>
                                {s === 'active' ? 'Active Admission' : 'Paused / Deactivated'}
                              </button>
                            ))}
                          </div>
                      </div>
                    </div>
                  </div>
               </div>
            )}
          </form>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/30 z-10 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
             <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-lg shadow-indigo-100"></div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admission Terminal Active</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-all"
            >
              Discard
            </button>
            <button 
              form="student-form"
              type="submit"
              disabled={loading || !isValid}
              className="flex-1 sm:flex-none px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Refactor Profile" : "Complete Admission")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
