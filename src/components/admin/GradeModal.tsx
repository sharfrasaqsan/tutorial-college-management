"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Info, GraduationCap, X, Hash } from "lucide-react";
import toast from "react-hot-toast";
import { Grade } from "@/types/models";

const gradeSchema = z.object({
  name: z.string().min(1, "Grade name is required"),
  level: z.string().min(1, "Academic level category is required"),
  status: z.enum(["active", "inactive"]),
});

type GradeForm = z.infer<typeof gradeSchema>;

interface GradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Grade | null;
}

export default function GradeModal({ isOpen, onClose, onSuccess, initialData }: GradeModalProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<GradeForm>({
    resolver: zodResolver(gradeSchema),
    mode: "onChange",
    defaultValues: {
        status: "active"
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        level: initialData.level || "",
        status: initialData.status,
      });
    } else {
      reset({
        name: "",
        level: "",
        status: "active",
      });
    }
  }, [initialData, reset, isOpen]);

  const onSubmit = async (data: GradeForm) => {
    setLoading(true);
    try {
      // Name check
      const dupQuery = query(collection(db, "grades"), where("name", "==", data.name));
      const dupSnap = await getDocs(dupQuery);
      const isDuplicate = dupSnap.docs.some(doc => initialData ? doc.id !== initialData.id : true);
      
      if (isDuplicate) {
        toast.error(`The grade "${data.name}" already exists.`);
        setLoading(false);
        return;
      }

      if (initialData) {
        await updateDoc(doc(db, "grades", initialData.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast.success("Grade updated successfully!");
      } else {
        await addDoc(collection(db, "grades"), {
          ...data,
          studentCount: 0,
          classCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("Grade added successfully!");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving grade:", error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Please try again'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    <GraduationCap className="w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {initialData ? "Edit Grade" : "Add Grade"}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> Registration
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

        <div className="flex-1 overflow-y-auto p-8 bg-white scrollbar-hide">
            <form id="grade-form" onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-12">
                <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Grade Name</label>
                            <input 
                                {...register("name")}
                                placeholder="e.g. Grade 11 (O/L)"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all font-medium text-slate-700"
                            />
                            {errors.name && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Category</label>
                            <select 
                                {...register("level")}
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all font-medium text-slate-700 appearance-none cursor-pointer"
                            >
                                <option value="">Select Category</option>
                                <option value="junior">Junior Secondary (G6-G9)</option>
                                <option value="ol">Ordinary Level (G10-G11)</option>
                                <option value="al">Advanced Level (G12-G13)</option>
                                <option value="higher">Higher Education / Professional</option>
                            </select>
                            {errors.level && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.level.message}</p>}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-100 text-indigo-600 shadow-sm">
                                <Info className="w-4 h-4" />
                            </div>
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600">Important Note</h4>
                        </div>
                        <p className="text-xs font-medium text-slate-400 leading-relaxed px-1">
                            {initialData ? "Updating this grade will affect all related classes and subjects. Please check before saving." : "Adding a grade helps you organize your student and class lists. Once in use, a grade cannot be easily deleted."}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Status</label>
                        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-80">
                            {["active", "inactive"].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => reset({ ...watch(), status: s as any })}
                                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${watch("status") === s ? (s === 'active' ? 'bg-slate-900 text-white shadow-xl' : 'bg-rose-500 text-white shadow-xl') : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </form>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grade Records Ready</p>
            <div className="flex items-center gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
                >
                  Discard
                </button>
                <button 
                  form="grade-form"
                  type="submit"
                  disabled={loading || !isValid}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-black transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Save Changes" : "Add Grade")}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
