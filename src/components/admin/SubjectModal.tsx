"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, BookType, Palette } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
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
  ];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
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
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={initialData ? "Modify Subject Definition" : "Define Curricular Subject"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Subject Name *</label>
                  <input 
                    {...register("name")}
                    placeholder="e.g. Pure Mathematics"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 ml-1">Subject Code *</label>
                  <input 
                    {...register("subjectCode")}
                    placeholder="e.g. MAT202"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {errors.subjectCode && <p className="text-xs text-red-500 ml-1 mt-1">{errors.subjectCode.message}</p>}
                </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2"><Palette className="w-3 h-3" /> Visual Style Identity *</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 {colors.map((c) => (
                    <label key={c.value} className="relative cursor-pointer group">
                        <input 
                            type="radio" 
                            {...register("color")}
                            value={c.value}
                            className="peer sr-only"
                        />
                        <div className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${c.value} border-transparent peer-checked:border-primary peer-checked:shadow-md peer-checked:shadow-primary/10 hover:border-slate-200`}>
                            <BookType className="w-5 h-5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{c.label}</span>
                        </div>
                    </label>
                 ))}
              </div>
              {errors.color && <p className="text-xs text-red-500 ml-1 mt-1">{errors.color.message}</p>}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Save Changes" : "Create Subject")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
