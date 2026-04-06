"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Info } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
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
    formState: { errors },
  } = useForm<GradeForm>({
    resolver: zodResolver(gradeSchema),
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
        toast.error(`The academic level "${data.name}" is already defined.`);
        setLoading(false);
        return;
      }

      if (initialData) {
        await updateDoc(doc(db, "grades", initialData.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast.success("Grade Configuration Updated!");
      } else {
        await addDoc(collection(db, "grades"), {
          ...data,
          studentCount: 0,
          classCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("Grade Level Initialized!");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving grade:", error);
      toast.error(`Operation Failed: ${error instanceof Error ? error.message : 'Unknown Error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={initialData ? "Edit Academic Configuration" : "New Grade Level"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1">Grade / Level Name *</label>
              <input 
                {...register("name")}
                placeholder="e.g. Grade 11 (O/L)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              {errors.name && <p className="text-xs text-red-500 ml-1 mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 ml-1">Academic Category *</label>
              <select 
                {...register("level")}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              >
                <option value="">Select Level Category</option>
                <option value="junior">Junior Secondary (G6-G9)</option>
                <option value="ol">Ordinary Level (G10-G11)</option>
                <option value="al">Advanced Level (G12-G13)</option>
                <option value="higher">Higher Education / Professional</option>
              </select>
              {errors.level && <p className="text-xs text-red-500 ml-1 mt-1">{errors.level.message}</p>}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3 text-amber-700">
               <Info className="w-5 h-5 flex-shrink-0" />
               <p className="text-xs font-medium leading-relaxed">
                 {initialData ? "Modifying this level will affect all future categorizations using this grade." : "Initializing a grade level allows you to categorize classes and enrollments correctly. You cannot delete a grade once it has active enrollments."}
               </p>
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (initialData ? "Save Changes" : "Initialize Level")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
