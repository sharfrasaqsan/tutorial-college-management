"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, BookType, Palette, X, Hash } from "lucide-react";
import toast from "react-hot-toast";
import { Subject } from "@/types/models";

const subjectSchema = z.object({
  name: z.string().min(3, "Subject name must be at least 3 characters"),
  subjectCode: z.string().min(2, "Subject code is required"),
  color: z.string().min(4, "Please select a color style"),
  status: z.enum(["active", "inactive"]),
});

type SubjectForm = z.infer<typeof subjectSchema>;

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Subject | null;
}

export default function SubjectModal({ isOpen, onClose, onSuccess, initialData }: SubjectModalProps) {
  const [loading, setLoading] = useState(false);

  const colors = [
    { label: "Emerald", value: "bg-emerald-100 text-emerald-600" },
    { label: "Blue", value: "bg-blue-100 text-blue-600" },
    { label: "Amber", value: "bg-amber-100 text-amber-600" },
    { label: "Rose", value: "bg-rose-100 text-rose-600" },
    { label: "Violet", value: "bg-violet-100 text-violet-600" },
    { label: "Indigo", value: "bg-indigo-100 text-indigo-600" },
    { label: "Teal", value: "bg-teal-100 text-teal-600" },
    { label: "Cyan", value: "bg-cyan-100 text-cyan-600" },
    { label: "Sky", value: "bg-sky-100 text-sky-600" },
    { label: "Orange", value: "bg-orange-100 text-orange-600" },
    { label: "Fuchsia", value: "bg-fuchsia-100 text-fuchsia-600" },
    { label: "Pink", value: "bg-pink-100 text-pink-600" },
  ];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    mode: "onChange",
    defaultValues: {
        color: "bg-emerald-100 text-emerald-600",
        status: "active"
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        subjectCode: initialData.subjectCode,
        color: initialData.color || "bg-emerald-100 text-emerald-600",
      });
    } else {
      reset({
        name: "",
        subjectCode: "",
        color: "bg-emerald-100 text-emerald-600",
        status: "active"
      });
    }
  }, [initialData, reset, isOpen]);

  const onSubmit = async (data: SubjectForm) => {
    setLoading(true);
    try {
      // Uniqueness check for Name or Code
      const dupQuery = query(
        collection(db, "subjects"), 
        where("name", "==", data.name)
      );
      const dupSnap = await getDocs(dupQuery);
      const nameTaken = dupSnap.docs.some(doc => initialData ? doc.id !== initialData.id : true);
      if (nameTaken) {
        toast.error(`Subject "${data.name}" already exists.`);
        setLoading(false);
        return;
      }

      const codeQuery = query(
          collection(db, "subjects"), 
          where("subjectCode", "==", data.subjectCode)
      );
      const codeSnap = await getDocs(codeQuery);
      const codeTaken = codeSnap.docs.some(doc => initialData ? doc.id !== initialData.id : true);
      if (codeTaken) {
        toast.error(`Subject code "${data.subjectCode}" is already in use.`);
        setLoading(false);
        return;
      }

      if (initialData) {
        await updateDoc(doc(db, "subjects", initialData.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast.success("Subject definition updated!");
      } else {
        await addDoc(collection(db, "subjects"), {
          ...data,
          studentCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("New subject category added!");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving subject:", error);
      toast.error("Process failed. Please verify connection.");
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
                    <BookType className="w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {initialData ? "Edit Subject" : "Add Subject"}
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
            <form id="subject-form" onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-12">
                <div className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Subject Name</label>
                            <input 
                                {...register("name")}
                                placeholder="e.g. Pure Mathematics"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all font-medium text-slate-700"
                            />
                            {errors.name && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.name.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Subject Code</label>
                            <input 
                                {...register("subjectCode")}
                                placeholder="e.g. MAT202"
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all font-medium text-slate-700"
                            />
                            {errors.subjectCode && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.subjectCode.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
                            <Palette className="w-3.5 h-3.5" /> Color
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {colors.map((c) => (
                                <label key={c.value} className="relative cursor-pointer group">
                                    <input 
                                        type="radio" 
                                        {...register("color")}
                                        value={c.value}
                                        className="peer sr-only"
                                    />
                                    <div className={`p-5 rounded-[1.5rem] border-2 transition-all flex flex-col items-center gap-2 ${c.value} border-transparent peer-checked:border-indigo-600 peer-checked:shadow-xl peer-checked:shadow-indigo-50 hover:border-slate-200`}>
                                        <BookType className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{c.label}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {errors.color && <p className="text-[10px] text-red-500 ml-1 font-bold">{errors.color.message}</p>}
                    </div>

                    <div className="space-y-2 border-t border-slate-100 pt-8">
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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ready</p>
            <div className="flex items-center gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
                >
                  Discard
                </button>
                <button 
                  form="subject-form"
                  type="submit"
                  disabled={loading || !isValid}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-black transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Save Changes" : "Add Subject")}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
