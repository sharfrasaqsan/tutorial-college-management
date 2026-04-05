"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { serverTimestamp, setDoc, doc, collection, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { Loader2, User, Mail, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { Subject, Grade, Teacher } from "@/types/models";

const teacherSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().optional(), // Handled in refinement
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  nic: z.string().min(10, "NIC is required"),
  subjects: z.array(z.string()).min(1, "Pick at least one subject"),
  grades: z.array(z.string()).min(1, "Pick at least one grade"),
  address: z.string().min(5, "Address is required"),
  status: z.enum(["active", "inactive"]),
}).refine((data) => {
    // If we're not passing an ID (i.e., creating), password is required
    return true; // We'll handle this in the submit logic or a more complex refinement
}, { message: "Password is required for new accounts" });

type TeacherForm = z.infer<typeof teacherSchema>;

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Teacher | null;
}

export default function TeacherModal({ isOpen, onClose, onSuccess, initialData }: TeacherModalProps) {
  const [loading, setLoading] = useState(false);
  const [dbSubjects, setDbSubjects] = useState<Subject[]>([]);
  const [dbGrades, setDbGrades] = useState<Grade[]>([]);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [subSnap, grSnap] = await Promise.all([
          getDocs(query(collection(db, "subjects"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "grades"), orderBy("name", "asc")))
        ]);
        setDbSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
        setDbGrades(grSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Grade)));
      } catch (error) {
        console.error("Error loading metadata:", error);
      }
    }
    if (isOpen) loadMetadata();
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
        status: initialData.status,
        password: "", // Keep empty on edit
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

  const onSubmit = async (data: TeacherForm) => {
    if (!initialData && (!data.password || data.password.length < 6)) {
        toast.error("Password is required and must be 6+ chars for new accounts");
        return;
    }

    setLoading(true);
    try {
      if (initialData) {
        // UPDATE Profile
        await updateDoc(doc(db, "teachers", initialData.id), {
          name: data.name,
          phone: data.phone,
          nic: data.nic,
          subjects: data.subjects,
          grades: data.grades,
          address: data.address,
          status: data.status,
          updatedAt: serverTimestamp(),
        });
        
        // Also update shared user record
        await updateDoc(doc(db, "users", initialData.id), {
          name: data.name,
          phone: data.phone,
        });

        toast.success("Faculty profile updated successfully!");
      } else {
        // CREATE
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password!);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, "users", uid), {
          uid,
          name: data.name,
          email: data.email,
          role: "teacher",
          phone: data.phone,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "teachers", uid), {
          uid,
          name: data.name,
          email: data.email,
          phone: data.phone,
          nic: data.nic,
          subjects: data.subjects,
          grades: data.grades,
          address: data.address,
          status: data.status,
          createdAt: serverTimestamp(),
        });

        toast.success("Teacher account successfully created!");
      }

      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error saving teacher:", error);
      toast.error(error.message || "Failed to save teacher profile.");
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
                  <label className="text-sm font-semibold text-slate-700 ml-1">Full Name</label>
                  <input 
                    {...register("name")}
                    placeholder="e.g. Mr. Sunil Perera"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">NIC Number</label>
                  <input 
                    {...register("nic")}
                    placeholder="e.g. 199012345678"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.nic && <p className="text-xs text-red-500 ml-1 mt-1">{errors.nic.message}</p>}
                </div>
            </div>
          </div>

          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <Mail className="w-3 h-3" /> System Access
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Official Email</label>
                  <input 
                    {...register("email")}
                    type="email"
                    disabled={!!initialData}
                    placeholder="teacher@tutorial.edu"
                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none transition-all ${!!initialData ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                  />
                  {errors.email && <p className="text-xs text-red-500 ml-1 mt-1">{errors.email.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">
                    {initialData ? 'Password (Read Only)' : 'Initial Password'}
                  </label>
                  <input 
                    {...register("password")}
                    type="password"
                    disabled={!!initialData}
                    placeholder={initialData ? "••••••••" : "Min 6 characters"}
                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none transition-all ${!!initialData ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary'}`}
                  />
                  {!initialData && errors.password && <p className="text-xs text-red-500 ml-1 mt-1">{errors.password.message}</p>}
                </div>
            </div>
          </div>

          <div className="space-y-4 col-span-full pt-4 border-t border-slate-50">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                <BookOpen className="w-3 h-3" /> Expertise & Grades
            </h4>
            
            <div className="space-y-2">
               <label className="text-sm font-semibold text-slate-700 ml-1">Subjects Handled</label>
               <div className="flex flex-wrap gap-2">
                  {dbSubjects.length > 0 ? dbSubjects.map(s => (
                    <button 
                        key={s.id}
                        type="button"
                        onClick={() => toggleItem("subjects", s.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedSubjects.includes(s.name) ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : "bg-white border-slate-200 text-slate-500 hover:border-primary/50"}`}
                    >
                        {s.name}
                    </button>
                  )) : (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 flex items-center gap-2">
                       No subjects found. <a href="/admin/subjects" className="underline font-bold">Add One First</a>
                    </p>
                  )}
               </div>
               {errors.subjects && <p className="text-xs text-red-500 ml-1 mt-1">{errors.subjects.message}</p>}
            </div>

            <div className="space-y-2">
               <label className="text-sm font-semibold text-slate-700 ml-1">Assigned Grades</label>
               <div className="flex flex-wrap gap-2">
                  {dbGrades.length > 0 ? dbGrades.map(g => (
                    <button 
                        key={g.id}
                        type="button"
                        onClick={() => toggleItem("grades", g.name)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedGrades.includes(g.name) ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : "bg-white border-slate-200 text-slate-500 hover:border-primary/50"}`}
                    >
                        {g.name}
                    </button>
                  )) : (
                    <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 flex items-center gap-2">
                       No grade levels found. <a href="/admin/grades" className="underline font-bold">Add One First</a>
                    </p>
                  )}
               </div>
               {errors.grades && <p className="text-xs text-red-500 ml-1 mt-1">{errors.grades.message}</p>}
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Phone Number</label>
                  <input 
                    {...register("phone")}
                    placeholder="e.g. 0712223334"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.phone && <p className="text-xs text-red-500 ml-1 mt-1">{errors.phone.message}</p>}
                </div>
            </div>
          </div>

          <div className="space-y-1 col-span-full pt-4 border-t border-slate-50">
            <label className="text-sm font-semibold text-slate-700 ml-1">Home Address</label>
            <textarea 
              {...register("address")}
              rows={2}
              placeholder="Full mailing address..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
            ></textarea>
            {errors.address && <p className="text-xs text-red-500 ml-1 mt-1">{errors.address.message}</p>}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Update Profile" : "Create Profile")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
