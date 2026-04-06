"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { serverTimestamp, setDoc, doc, collection, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { Loader2, User, Mail, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { Subject, Grade, Teacher } from "@/types/models";
import { generateId } from "@/lib/id-generator";
import Skeleton from "@/components/ui/Skeleton";

const teacherSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  nic: z.string().min(10, "NIC is required"),
  subjects: z.array(z.string()).min(1, "Pick at least one subject"),
  grades: z.array(z.string()).min(1, "Pick at least one grade"),
  address: z.string().min(5, "Address is required"),
  gender: z.enum(["male", "female", "other"]),
  status: z.enum(["active", "inactive"]),
});

type TeacherForm = z.infer<typeof teacherSchema>;

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Teacher | null;
}

export default function TeacherModal({ isOpen, onClose, onSuccess, initialData }: TeacherModalProps) {
  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [dbSubjects, setDbSubjects] = useState<Subject[]>([]);
  const [dbGrades, setDbGrades] = useState<Grade[]>([]);

  useEffect(() => {
    const loadMetadata = async () => {
      if (isOpen) {
        setMetaLoading(true);
        try {
          const [subSnap, grSnap] = await Promise.all([
            getDocs(query(collection(db, "subjects"), orderBy("name", "asc"))),
            getDocs(query(collection(db, "grades"), orderBy("name", "asc")))
          ]);
          setDbSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)).filter(s => s.status === 'active'));
          setDbGrades(grSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)).filter(g => g.status === 'active'));
        } catch (error) {
          console.error("Error loading metadata:", error);
        } finally {
          setMetaLoading(false);
        }
      }
    };
    loadMetadata();
  }, [isOpen]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      status: "active",
      gender: "male",
      subjects: [],
      grades: [],
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        email: initialData.email,
        phone: initialData.phone,
        nic: (initialData as any).nic || "",
        subjects: initialData.subjects || [],
        grades: initialData.grades || [],
        address: (initialData as any).address || "",
        gender: initialData.gender || "male",
        status: initialData.status,
        password: "",
      });
    } else {
      reset({
        name: "",
        email: "",
        phone: "",
        nic: "",
        subjects: [],
        grades: [],
        address: "",
        gender: "male",
        status: "active",
        password: "",
      });
    }
  }, [initialData, reset, isOpen]);

  const selectedSubjects = watch("subjects");
  const selectedGrades = watch("grades");

  const toggleItem = (field: "subjects" | "grades", value: string) => {
    const current = field === "subjects" ? selectedSubjects : selectedGrades;
    const updated = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
    setValue(field, updated, { shouldValidate: true });
  };

  const handlePasswordReset = async () => {
    if (!initialData?.email) return;
    try {
        await sendPasswordResetEmail(auth, initialData.email);
        toast.success(`Security reset link dispatched to ${initialData.email}`);
    } catch (err: any) {
        console.error("Reset error:", err);
        toast.error("Failed to dispatcher security link.");
    }
  };

  const onSubmit = async (data: TeacherForm) => {
    if (!initialData && (!data.password || data.password.length < 6)) {
        toast.error("Password is required and must be 6+ chars for new accounts");
        return;
    }

    setLoading(true);
    try {
      if (initialData) {
        const teacherId = initialData.teacherId || await generateId("teacher");
        await updateDoc(doc(db, "teachers", initialData.id), {
          name: data.name,
          email: data.email,
          phone: data.phone,
          nic: data.nic,
          subjects: data.subjects,
          grades: data.grades,
          address: data.address,
          status: data.status,
          teacherId,
          updatedAt: serverTimestamp(),
        });
        
        await updateDoc(doc(db, "users", initialData.id), {
          name: data.name,
          phone: data.phone,
        });

        toast.success("Faculty profile updated successfully!");
      } else {
        const teacherId = await generateId("teacher");
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password!);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, "users", uid), {
          uid,
          name: data.name,
          email: data.email,
          role: "teacher",
          teacherId,
          phone: data.phone,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "teachers", uid), {
          uid,
          teacherId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          nic: data.nic,
          subjects: data.subjects,
          grades: data.grades,
          address: data.address,
          gender: data.gender,
          status: data.status,
          createdAt: serverTimestamp(),
        });

        toast.success("Teacher account successfully created!");
      }

      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving teacher:", err);
      toast.error(err.message || "Failed to save teacher profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Update Faculty Profile" : "Register New Faculty Member"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 col-span-full">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <User className="w-3 h-3" /> Identity & Credentials
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Full Name *</label>
                  <input 
                    {...register("name")}
                    placeholder="e.g. Mr. Sunil Perera"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">NIC Number *</label>
                  <input 
                    {...register("nic")}
                    placeholder="e.g. 199012345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.nic && <p className="text-xs text-red-500 ml-1 mt-1">{errors.nic.message}</p>}
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
                </div>
            </div>
          </div>

          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <Mail className="w-3 h-3" /> System Access
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Official Email *</label>
                  <input 
                    {...register("email")}
                    type="email"
                    disabled={!!initialData}
                    placeholder="teacher@tutorial.edu"
                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${initialData ? 'bg-slate-100 cursor-not-allowed opacity-70' : 'bg-slate-50'}`}
                  />
                  {initialData && <p className="text-[10px] text-slate-400 ml-1 mt-2">Login email is locked for security. To change, please contact +94751230001 or sharfrasaqsan@gmail.com.</p>}
                  {errors.email && <p className="text-xs text-red-500 ml-1 mt-1">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">
                    {initialData ? 'Security Management' : 'Initial Password *'}
                  </label>
                  {initialData ? (
                    <button 
                        type="button" 
                        onClick={handlePasswordReset}
                        className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200"
                    >
                        Send Password Recovery Email
                    </button>
                  ) : (
                    <input 
                      {...register("password")}
                      type="password"
                      placeholder="Min 6 characters"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    />
                  )}
                  {errors.password && !initialData && <p className="text-xs text-red-500 ml-1 mt-1">{errors.password.message}</p>}
                  {initialData && <p className="text-[10px] text-slate-400 ml-1">Credentials are managed via secure authentication links.</p>}
                </div>
            </div>
          </div>

          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> Expertise & Grades
            </h4>
            
            <div className="space-y-2">
               <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center justify-between">
                  Subjects Handled *
                  {dbSubjects.length === 0 && !metaLoading && <span className="text-[10px] text-red-500 italic">No subject definitions found</span>}
               </label>
               <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl min-h-[50px]">
                  {metaLoading ? (
                    <div className="flex flex-wrap gap-2 w-full">
                       {[1,2,3,4].map(i => <Skeleton key={i} width="80px" height="32px" className="rounded-lg" />)}
                    </div>
                  ) : dbSubjects.length > 0 ? dbSubjects.map(s => (
                    <button 
                        key={s.id}
                        type="button"
                        onClick={() => toggleItem("subjects", s.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedSubjects.includes(s.name) ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : "bg-white border-slate-200 text-slate-500 hover:border-primary/50"}`}
                    >
                        {s.name}
                    </button>
                  )) : (
                    <div className="flex items-center gap-2 text-slate-400">
                        <AlertCircle className="w-4 h-4" />
                        <p className="text-xs">No subjects available. <Link href="/admin/subjects" className="text-primary hover:underline font-bold">Set up subjects first.</Link></p>
                    </div>
                  )}
               </div>
               {errors.subjects && <p className="text-xs text-red-500 ml-1 mt-1">{errors.subjects.message}</p>}
            </div>

            <div className="space-y-2">
               <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center justify-between">
                  Assigned Grades *
                  {dbGrades.length === 0 && !metaLoading && <span className="text-[10px] text-red-500 italic">No grade definitions found</span>}
               </label>
               <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl min-h-[50px]">
                  {metaLoading ? (
                    <div className="flex flex-wrap gap-2 w-full">
                       {[1,2,3].map(i => <Skeleton key={i} width="100px" height="32px" className="rounded-lg" />)}
                    </div>
                  ) : dbGrades.length > 0 ? dbGrades.map(g => (
                    <button 
                        key={g.id}
                        type="button"
                        onClick={() => toggleItem("grades", g.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedGrades.includes(g.name) ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : "bg-white border-slate-200 text-slate-500 hover:border-primary/50"}`}
                    >
                        {g.name}
                    </button>
                  )) : (
                    <div className="flex items-center gap-2 text-slate-400">
                        <AlertCircle className="w-4 h-4" />
                        <p className="text-xs">No grades available. <Link href="/admin/grades" className="text-primary hover:underline font-bold">Set up grades first.</Link></p>
                    </div>
                  )}
               </div>
               {errors.grades && <p className="text-xs text-red-500 ml-1 mt-1">{errors.grades.message}</p>}
            </div>
            
            <div className="grid grid-cols-1 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">WhatsApp / Phone Number *</label>
                  <input 
                    {...register("phone")}
                    placeholder="e.g. 0712223334"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
            </div>
          </div>

          <div className="space-y-1 col-span-full pt-4 border-t border-slate-50">
            <label className="text-sm font-semibold text-slate-700 ml-1">Mailing Address *</label>
            <textarea 
              {...register("address")}
              rows={2}
              placeholder="Full home or mailing address..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
            ></textarea>
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Update Profile" : "Register Faculty")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
