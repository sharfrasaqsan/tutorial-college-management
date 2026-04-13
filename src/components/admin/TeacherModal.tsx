"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { serverTimestamp, setDoc, doc, collection, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { Loader2, User, Mail, BookOpen, AlertCircle, X, Phone, MapPin, Shield, CheckCircle, Hash, GraduationCap } from "lucide-react";
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
    formState: { errors, isValid },
  } = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    mode: "onChange",
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
        nic: initialData.nic || "",
        subjects: initialData.subjects || [],
        grades: initialData.grades || [],
        address: initialData.address || "",
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
    } catch (err) {
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
      // Uniqueness check for NIC
      const normalizedNIC = data.nic.trim().toUpperCase();
      const nicQuery = query(collection(db, "teachers"), where("nic", "==", normalizedNIC));
      const nicSnap = await getDocs(nicQuery);
      
      // If NIC exists on a DIFFERENT document
      const isDuplicateNIC = nicSnap.docs.some((doc) => doc.id !== initialData?.id);
      
      if (isDuplicateNIC) {
        toast.error(`Faculty member with NIC ${normalizedNIC} is already registered.`);
        setLoading(false);
        return;
      }
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
    } catch (err) {
      const error = err as Error;
      console.error("Error saving teacher:", error);
      toast.error(error.message || "Failed to save teacher profile.");
    } finally {
      setLoading(false);
    }
  };
  const [activeTab, setActiveTab] = useState<'overview' | 'expertise' | 'security'>('overview');

  const teacherName = watch("name") || (initialData?.name || "New Faculty");
  const teacherInitials = teacherName.charAt(0).toUpperCase();

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {teacherInitials}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {initialData ? "Refactor Faculty Profile" : "Authorize New Faculty"}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> {initialData?.teacherId || "PENDING-ID"}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${watch("status") === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {watch("status")}
                         </span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group">
                <X className="w-5 h-5" />
            </button>
        </div>

        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['overview', 'expertise', 'security'] as const).map((tab) => (
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
          <form id="teacher-form" onSubmit={handleSubmit(onSubmit)} className="animate-in fade-in duration-500">
            {activeTab === 'overview' && (
              <div className="max-w-4xl mx-auto space-y-10">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <User className="w-3.5 h-3.5" /> Faculty Identity
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Legal Full Name</label>
                      <input {...register("name")} placeholder="e.g. Mr. Sunil Perera" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-700" />
                      {errors.name && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">NIC Number</label>
                       <input {...register("nic")} placeholder="Institutional ID Card No." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                       {errors.nic && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.nic.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">WhatsApp / Contact</label>
                       <div className="relative">
                          <input {...register("phone")} placeholder="07XXXXXXXX" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                          <Phone className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Gender Identification</label>
                      <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        {["male", "female", "other"].map((g) => (
                          <button key={g} type="button" onClick={() => setValue("gender", g as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold capitalize transition-all ${watch("gender") === g ? 'bg-white shadow-sm text-primary border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-full space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Operational Status</label>
                        <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                          {["active", "inactive"].map((s) => (
                            <button key={s} type="button" onClick={() => setValue("status", s as any)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${watch("status") === s ? (s === 'active' ? 'bg-slate-900 text-white shadow-md' : 'bg-rose-500 text-white shadow-md') : 'text-slate-400 hover:text-slate-600'}`}>
                              {s === 'active' ? 'Active Operational' : 'Paused / Deactivated'}
                            </button>
                          ))}
                        </div>
                    </div>
                    <div className="col-span-full space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Residential Coordinates</label>
                       <div className="relative">
                          <textarea {...register("address")} rows={4} placeholder="Full home or mailing address..." className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700 resize-none pt-4" />
                          <MapPin className="absolute left-4.5 top-5.5 w-4 h-4 text-slate-300" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'expertise' && (
              <div className="max-w-4xl mx-auto space-y-12">
                 <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5" /> Subject specializations
                       </h4>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedSubjects.length} Selected</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       {metaLoading ? Array(8).fill(0).map((_, i) => <Skeleton key={i} height="50px" className="rounded-xl" />) : dbSubjects.map(s => (
                         <button key={s.id} type="button" onClick={() => toggleItem("subjects", s.name)} className={`p-4 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all text-center ${selectedSubjects.includes(s.name) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                           {s.name}
                         </button>
                       ))}
                    </div>
                    {errors.subjects && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.subjects.message}</p>}
                 </div>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <GraduationCap className="w-3.5 h-3.5" /> Assigned Grade Levels
                       </h4>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedGrades.length} Levels</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       {metaLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} height="50px" className="rounded-xl" />) : dbGrades.map(g => (
                         <button key={g.id} type="button" onClick={() => toggleItem("grades", g.name)} className={`p-4 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all text-center ${selectedGrades.includes(g.name) ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                           {g.name}
                         </button>
                       ))}
                    </div>
                    {errors.grades && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.grades.message}</p>}
                 </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="max-w-4xl mx-auto space-y-10 py-4">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <Shield className="w-3.5 h-3.5" /> System Access & Credentials
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Official Email Address</label>
                       <div className="relative">
                          <input {...register("email")} disabled={!!initialData} type="email" placeholder="teacher@tutorial.edu" className={`w-full pl-12 pr-5 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700 ${initialData ? 'bg-slate-100 cursor-not-allowed opacity-70' : 'bg-slate-50'}`} />
                          <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                       {initialData && <p className="text-[9px] text-slate-400 font-medium ml-1 mt-2">Login identifiers are locked. Use security link to reset credentials.</p>}
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                          {initialData ? 'Security Management' : 'Primary Access Key'}
                       </label>
                       {initialData ? (
                          <button type="button" onClick={handlePasswordReset} className="w-full px-5 py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-3 shadow-lg">
                              <Shield className="w-4 h-4" /> Send Recovery Link
                          </button>
                       ) : (
                          <input {...register("password")} type="password" placeholder="Min 6 characters required" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700" />
                       )}
                       {errors.password && !initialData && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.password.message}</p>}
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                     <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                     <div>
                        <p className="text-[10px] font-bold uppercase text-slate-900 tracking-wider">Operational Security Awareness</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                          Personnel credentials are encrypted and stored in institutional vaults. Modifying primary email accounts requires administrative authority clearing.
                        </p>
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
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faculty Management System Active</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-all">
              Discard
            </button>
            <button 
                form="teacher-form" 
                type="submit" 
                disabled={loading || !isValid} 
                className="flex-1 sm:flex-none px-10 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Refactor Profile" : "Authorize Faculty")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
