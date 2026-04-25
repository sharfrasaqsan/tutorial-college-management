"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  X,
  Search,
  CreditCard,
  Calendar,
  BookOpen,
  Loader2,
  CheckCircle2,
  Hash,
  ArrowRight,
  Receipt,
  Users,
  ShieldCheck,
} from "lucide-react";
import { Student, Class } from "@/types/models";
import toast from "react-hot-toast";
import { format } from "date-fns";

import Skeleton from "@/components/ui/Skeleton";
import { getPaymentCycleKey } from "@/lib/formatters";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
  onSuccess?: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  initialStudentId,
  onSuccess,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "verification">("info");

  // Form State
  const [studentId, setStudentId] = useState(initialStudentId || "");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [month, setMonth] = useState(getPaymentCycleKey());
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("cash");

  // Search Results
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Load students for search if needed
  useEffect(() => {
    if (isOpen && !initialStudentId) {
      loadStudents();
    }
  }, [isOpen, initialStudentId]);

  // Load specific student if ID provided
  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentDetails(studentId);
    }
  }, [isOpen, studentId]);

  const loadStudents = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "students"), orderBy("name", "asc")),
      );
      setStudentsList(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Student),
      );
    } catch (e) {
      toast.error("Cloud node unreachable.");
    }
  };

  const fetchStudentDetails = async (id: string) => {
    setSearching(true);
    try {
      const studentDoc = await getDoc(doc(db, "students", id));
      if (studentDoc.exists()) {
        const std = { id: studentDoc.id, ...studentDoc.data() } as Student;
        setSelectedStudent(std);

        // Fetch his classes
        if (std.enrolledClasses && std.enrolledClasses.length > 0) {
          const classPromises = std.enrolledClasses.map((cid) =>
            getDoc(doc(db, "classes", cid)),
          );
          const classSnaps = await Promise.all(classPromises);
          const classes = classSnaps
            .filter((s) => s.exists())
            .map((s) => ({ id: s.id, ...s.data() }) as Class);
          setEnrolledClasses(classes);

          // Auto-select first class if only one
          if (classes.length === 1) {
            setSelectedClassIds([classes[0].id]);
            setAmount(classes[0].monthlyFee || 0);
          } else {
            setSelectedClassIds([]);
            setAmount(0);
          }
        } else {
          setEnrolledClasses([]);
          setSelectedClassIds([]);
          setAmount(0);
        }
      }
    } catch (error) {
      console.error("Error fetching student details:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleClassChange = (cid: string) => {
    setSelectedClassIds((prev) => {
      const newIds = prev.includes(cid)
        ? prev.filter((id) => id !== cid)
        : [...prev, cid];

      // Recalculate total amount from fees of selected classes
      const total = enrolledClasses
        .filter((c) => newIds.includes(c.id))
        .reduce((sum, c) => sum + (c.monthlyFee || 0), 0);

      setAmount(total);
      return newIds;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!studentId || selectedClassIds.length === 0 || !month || !amount) {
      toast.error("Verification failed. Missing parameters.");
      return;
    }

    // Date Validation
    if (selectedStudent?.createdAt) {
      const joinDate = (selectedStudent.createdAt as any).toDate ? (selectedStudent.createdAt as any).toDate() : new Date(selectedStudent.createdAt as any);
      const [selYear, selMonth] = month.split("-").map(Number);
      const joinYear = joinDate.getFullYear();
      const joinMonth = joinDate.getMonth();

      if (selYear < joinYear || (selYear === joinYear && (selMonth - 1) < joinMonth)) {
        toast.error("Cannot collect fees for months prior to student registration.");
        return;
      }
    }

    setLoading(true);
    try {
      const selectedClasses = enrolledClasses.filter((c) =>
        selectedClassIds.includes(c.id),
      );

      const paymentData = {
        studentId,
        studentName: selectedStudent?.name || "Student",
        classIds: selectedClassIds,
        classNames: selectedClasses.map((c) => c.name),
        className: selectedClasses.map((c) => c.name).join(", "),
        subjects: selectedClasses.map((c) => c.subject),
        subject:
          selectedClasses.length > 1
            ? "Multiple Classes"
            : selectedClasses[0]?.subject || "",
        amount: Number(amount),
        month,
        method,
        status: "paid",
        createdAt: serverTimestamp(),
        // Breakdown for PDF
        items: selectedClasses.map((c) => ({
          name: c.name,
          subject: c.subject,
          amount: c.monthlyFee || 0,
        })),
      };

      await addDoc(collection(db, "payments"), paymentData);

      toast.success("Transaction verified. Cloud synchronized.");

      onSuccess?.();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Error saving payment:", error);
      toast.error("Internal server error during settlement.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (!initialStudentId) {
      setStudentId("");
      setSelectedStudent(null);
      setEnrolledClasses([]);
      setSearchTerm("");
      setShowDropdown(false);
    }
    setSelectedClassIds([]);
    setMonth(getPaymentCycleKey());
    setAmount(0);
    setActiveTab("info");
  };

  const initials = selectedStudent?.name?.charAt(0).toUpperCase() || "P";

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div
        className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`}
        onClick={onClose}
      ></div>

      <div
        className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        {/* 🏛️ Header Segment */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
          <div className="flex items-center gap-5">
            <div
              className={`w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-bold transition-all duration-500 ${loading ? "animate-pulse bg-primary/10 text-primary" : "text-primary"}`}
            >
              {searching ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                initials
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                Collect Student Fees
              </h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5" />{" "}
                  {selectedStudent?.studentId || "PENDING SELECTION"}
                </span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Financial Node Active
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

        {/* 🛣️ Navigation Segment */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
          {[
            { id: "info", label: "Identity & Source", icon: Users },
            { id: "verification", label: "Payment Ledger", icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 text-sm font-medium transition-all relative flex items-center gap-2 ${activeTab === tab.id ? "text-primary" : "text-slate-500 hover:text-slate-800"}`}
            >
              <tab.icon
                className={`w-4 h-4 ${activeTab === tab.id ? "text-primary" : "text-slate-400"}`}
              />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all" />
              )}
            </button>
          ))}
        </div>

        {/* 🌑 Content Segment */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
          <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-10">
            {activeTab === "info" && (
              <div className="space-y-12">
                <section className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                    <Search className="w-3.5 h-3.5" /> Source Selection
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Student Registry
                      </label>
                      {!initialStudentId ? (
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                          <input
                            type="text"
                            placeholder="Type student name or ID..."
                            value={searchTerm}
                            onFocus={() => setShowDropdown(true)}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                              setShowDropdown(true);
                              if (studentId) setStudentId(""); // Reset selection if typing starts
                            }}
                            className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-700 shadow-sm"
                          />
                          
                          {showDropdown && searchTerm && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[150] overflow-hidden max-h-[300px] overflow-y-auto divide-y divide-slate-50 animate-in fade-in slide-in-from-top-2 duration-300">
                              {studentsList
                                .filter(s => 
                                  s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  s.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setStudentId(s.id);
                                      setSearchTerm(s.name);
                                      setShowDropdown(false);
                                    }}
                                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left group/res"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="w-8 h-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center text-[10px] font-black uppercase tracking-tighter group-hover/res:bg-primary group-hover/res:text-white transition-all">
                                        {s.name.charAt(0)}
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">
                                          {s.name}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                          ID: {s.studentId}
                                        </p>
                                      </div>
                                    </div>
                                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover/res:text-primary transition-all group-hover/res:translate-x-1" />
                                  </button>
                                ))}
                              {studentsList.filter(s => 
                                s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                s.studentId?.toLowerCase().includes(searchTerm.toLowerCase())
                              ).length === 0 && (
                                <div className="p-8 text-center bg-slate-50/30">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">No matches found</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="px-5 py-4 bg-primary/5 border border-primary/10 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                {selectedStudent?.name || "Loading..."}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Locked ID: {selectedStudent?.studentId}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-black uppercase bg-white px-2 py-0.5 rounded border border-primary/10 text-primary tracking-widest">
                            Verified
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Academic Class Filter
                      </label>
                      <div className="space-y-2">
                        {searching ? (
                          <Skeleton height="50px" className="rounded-xl" />
                        ) : enrolledClasses.length > 0 ? (
                          enrolledClasses.map((cls) => (
                            <button
                              key={cls.id}
                              type="button"
                              onClick={() => handleClassChange(cls.id)}
                              className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${selectedClassIds.includes(cls.id) ? "bg-slate-900 border-slate-900 text-white shadow-xl translate-x-[-4px]" : "bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-200"}`}
                            >
                              <div className="flex items-center gap-3">
                                <BookOpen
                                  className={`w-4 h-4 ${selectedClassIds.includes(cls.id) ? "text-primary-light" : "text-slate-300"}`}
                                />
                                <div>
                                  <h5 className="text-xs font-bold">
                                    {cls.name}
                                  </h5>
                                  <p
                                    className={`text-[9px] font-bold uppercase tracking-widest ${selectedClassIds.includes(cls.id) ? "text-slate-400" : "text-slate-400"}`}
                                  >
                                    {cls.subject}
                                  </p>
                                </div>
                              </div>
                              {selectedClassIds.includes(cls.id) && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              )}
                            </button>
                          ))
                        ) : studentId ? (
                          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3">
                            <X className="w-4 h-4 text-rose-500" />
                            <p className="text-[10px] font-bold text-rose-600 uppercase">
                              No active enrollment found
                            </p>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                            <ArrowRight className="w-4 h-4 text-slate-300" />
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                              Waiting for selection
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-12">
                    <button
                      type="button"
                      onClick={() => setActiveTab("verification")}
                      disabled={selectedClassIds.length === 0}
                      className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-50"
                    >
                      Verify Ledger <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "verification" && (
              <div className="space-y-12">
                <section className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                    <CreditCard className="w-3.5 h-3.5" /> Ledger Details
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Fee Amount (LKR)
                      </label>
                      <div className="relative group">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-bold group-focus-within:text-primary transition-all">
                          Rs.
                        </span>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value))}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black outline-none focus:border-primary focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all shadow-inner text-slate-800"
                          required
                        />
                      </div>
                      <p className="text-[10px] font-bold text-emerald-600 ml-1 italic tracking-wide">
                        Suggested amount based on class registry
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Billing Month
                      </label>
                      <div className="relative group">
                        <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-primary transition-all" />
                         <input
                          type="month"
                          value={month}
                          min={selectedStudent?.createdAt ? 
                            ((selectedStudent.createdAt as any).toDate ? 
                              format((selectedStudent.createdAt as any).toDate(), "yyyy-MM") : 
                              format(new Date(selectedStudent.createdAt as any), "yyyy-MM")) 
                            : undefined}
                          onChange={(e) => setMonth(e.target.value)}
                          className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold uppercase tracking-[0.1em] outline-none focus:border-primary focus:ring-8 focus:ring-primary/5 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="col-span-full space-y-3">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Payment Channel
                      </label>
                      <div className="grid grid-cols-3 gap-4">
                        {["cash", "card", "bank"].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setMethod(m)}
                            className={`py-5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden shadow-sm ${method === m ? "border-slate-900 bg-slate-900 text-white shadow-xl" : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"}`}
                          >
                            {m}
                            {method === m && (
                              <div className="absolute top-1 right-2">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {/* 📊 Footer Segment */}
        <div className="px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/30 z-10 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-100"></div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Vault Sync Active • Manual Receipting
            </p>
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
              onClick={() => handleSubmit()}
              disabled={loading || selectedClassIds.length === 0 || !amount}
              className="flex-1 sm:flex-none px-10 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Complete Settlement
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
