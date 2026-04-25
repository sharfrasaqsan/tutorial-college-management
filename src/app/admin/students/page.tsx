"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  onSnapshot,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  writeBatch,
  increment,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  Trash2,
  Ban,
  CheckCircle,
  X,
  Users,
  Layers,
  CreditCard,
  Briefcase,
  ArrowRight,
  Projector,
  AlertTriangle,
  History,
  GraduationCap,
  ArrowLeft,
  Loader2,
  Download,
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Student, Grade, Subject, Class, Payment } from "@/types/models";
import Link from "next/link";
import StudentModal from "@/components/admin/StudentModal";
import PaymentModal from "@/components/admin/PaymentModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import toast from "react-hot-toast";
import { useStudentProfile } from "@/context/StudentProfileContext";
import { format } from "date-fns";
import {
  generateStudentListPDF,
  generateMasterRosterPDF,
} from "@/lib/pdf-generator";
import {
  formatPaymentMonth,
  getPaymentCycleKey,
  isPaymentInCycle,
} from "@/lib/formatters";
import { useMemo } from "react";

export default function StudentsPage() {
  const { openStudentProfile } = useStudentProfile();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [arrearsStudentIds, setArrearsStudentIds] = useState<Set<string>>(
    new Set(),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [calculatingArrears, setCalculatingArrears] = useState(false);

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentStudentId, setPaymentStudentId] = useState<string | null>(null);

  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [classesList, setClassesList] = useState<Record<string, boolean>>({});

  // Hierarchical Filter State
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [allClasses, setAllClasses] = useState<Class[]>([]);

  const [forceShowAll, setForceShowAll] = useState(false);
  // Use previous month for arrears
  const arrearsLabelDate = new Date();
  arrearsLabelDate.setMonth(arrearsLabelDate.getMonth() - 1);
  const arrearsDisplayMonth = formatPaymentMonth(
    getPaymentCycleKey(arrearsLabelDate),
  );

  const loadArrearsStatus = async (studentList: Student[]) => {
    setCalculatingArrears(true);
    try {
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const cycleKey = getPaymentCycleKey(prevMonthDate);
      const monthName = format(prevMonthDate, "MMMM");
      
      const q = query(
        collection(db, "payments"), 
        where("month", "in", [cycleKey, monthName])
      );
      
      const paymentSnap = await getDocs(q);
      const paidStudentsPrevMonth = new Set<string>();

      paymentSnap.docs.forEach((paymentDoc) => {
        const payment = { id: paymentDoc.id, ...paymentDoc.data() } as Payment;
        const status = (payment.status || "").toLowerCase();
        if (status === "paid" || status === "partial") {
          paidStudentsPrevMonth.add(payment.studentId);
        }
      });

      const prevMonthYear = prevMonthDate.getFullYear();
      const prevMonthIdx = prevMonthDate.getMonth();

      const arrearsIds = new Set(
        studentList
          .filter((student) => student.status === "active")
          .filter((student) => {
            if (!student.createdAt) return false;
            const joinDate = (student.createdAt as any).toDate ? (student.createdAt as any).toDate() : new Date(student.createdAt as any);
            const joinYear = joinDate.getFullYear();
            const joinMonth = joinDate.getMonth();

            // Joined before or during previous month
            const joinedBeforeOrDuring = joinYear < prevMonthYear || (joinYear === prevMonthYear && joinMonth <= prevMonthIdx);
            
            return joinedBeforeOrDuring && !paidStudentsPrevMonth.has(student.id);
          })
          .map((student) => student.id),
      );

      setArrearsStudentIds(arrearsIds);
    } catch (error) {
      console.error("Error loading arrears data", error);
      setArrearsStudentIds(new Set());
    } finally {
      setCalculatingArrears(false);
    }
  };

  useEffect(() => {
    // 1. Real-time Students Listener
    const studentsQ = query(collection(db, "students"), orderBy("createdAt", "desc"));
    const unsubscribeStudents = onSnapshot(studentsQ, (snap) => {
      const fetchedStudents = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Student,
      );
      setStudents(fetchedStudents);
      loadArrearsStatus(fetchedStudents);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to students:", error);
      setLoading(false);
    });

    // 2. Real-time Grades & Subjects Listener
    const gradesQ = query(collection(db, "grades"), orderBy("name", "asc"));
    const unsubscribeGrades = onSnapshot(gradesQ, (snap) => {
      setGrades(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Grade));
    });

    const subjectsQ = query(collection(db, "subjects"), orderBy("name", "asc"));
    const unsubscribeSubjects = onSnapshot(subjectsQ, (snap) => {
      setSubjects(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Subject));
    });

    const classesQ = collection(db, "classes");
    const unsubscribeClasses = onSnapshot(classesQ, (snap) => {
      const cList = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Class);
      setAllClasses(cList);
      
      const classMap: Record<string, boolean> = {};
      snap.docs.forEach((d) => (classMap[d.id] = true));
      setClassesList(classMap);
    });

    return () => {
      unsubscribeStudents();
      unsubscribeGrades();
      unsubscribeSubjects();
      unsubscribeClasses();
    };
  }, []);

  const toggleStatus = async (student: Student) => {
    try {
      const newStatus = student.status === "active" ? "inactive" : "active";
      await updateDoc(doc(db, "students", student.id), {
        status: newStatus || "active",
      });
      toast.success(
        newStatus === "active"
          ? "Student account restored."
          : "Student account suspended.",
      );
    } catch {
      toast.error("Status update failed.");
    }
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedStudent(null);
    setIsModalOpen(true);
  };

  const handleCollectPayment = (sid?: string) => {
    setPaymentStudentId(sid || null);
    setIsPaymentOpen(true);
  };

  const confirmDelete = (id: string) => {
    setStudentToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;
    setDeleting(true);
    const batch = writeBatch(db);
    try {
      const student = students.find((s) => s.id === studentToDelete);
      if (student) {
        // 1. Decrement Grade Count
        if (student.gradeId && grades.some((g) => g.id === student.gradeId)) {
          batch.update(doc(db, "grades", student.gradeId), {
            studentCount: increment(-1),
          });
        }

        // 2. Decrement Class Counts
        student.enrolledClasses?.forEach((cid) => {
          if (classesList[cid]) {
            batch.update(doc(db, "classes", cid), {
              studentCount: increment(-1),
            });
          }
        });

        // 3. Decrement Subject Counts
        student.enrolledSubjects?.forEach((sid) => {
          if (subjects.some((s) => s.id === sid)) {
            batch.update(doc(db, "subjects", sid), {
              studentCount: increment(-1),
            });
          }
        });
      }

      // 4. Delete Student
      batch.delete(doc(db, "students", studentToDelete));

      await batch.commit();
      toast.success("Student record purged and enrollment counts updated.");
      setIsDeleteOpen(false);
      setStudentToDelete(null);
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("Process failed.");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setFilterStatus("");
    setSearchTerm("");
  };

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesGrade = !selectedGradeId || s.gradeId === selectedGradeId;
      const matchesClass =
        !selectedClassId ||
        (s.enrolledClasses && s.enrolledClasses.includes(selectedClassId));

      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.phone?.includes(searchTerm) ||
        s.studentId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === "" || s.status === filterStatus;

      return matchesGrade && matchesClass && matchesSearch && matchesStatus;
    });
  }, [students, selectedGradeId, selectedClassId, searchTerm, filterStatus]);

  const activeGrade = grades.find((g) => g.id === selectedGradeId);
  const activeClass = allClasses.find((c) => c.id === selectedClassId);

  const handleExport = () => {
    const title = activeClass
      ? `${activeClass.name} Student List`
      : activeGrade
        ? `${activeGrade.name} Student List`
        : "Institutional Student List";
    const subtitle = activeClass
      ? `Curriculum: ${activeClass.subject}`
      : activeGrade
        ? `Level: ${activeGrade.name}`
        : "Comprehensive Directory";
    generateStudentListPDF(filteredStudents, title, subtitle);
  };

  const statCards = useMemo(() => [
    {
      title: "Filtered Students",
      value: filteredStudents.length,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Active Enrollment",
      value: filteredStudents.filter((s) => s.status === "active").length,
      icon: CheckCircle,
      color: "text-emerald-500",
    },
    {
      title: "Suspended Accounts",
      value: filteredStudents.filter((s) => s.status === "inactive").length,
      icon: Ban,
      color: "text-rose-500",
    },
    {
      title: "Available Classes",
      value: allClasses.filter((c) => c.gradeId === selectedGradeId).length,
      icon: Layers,
      color: "text-indigo-500",
    },
  ], [filteredStudents, allClasses, selectedGradeId]);

  const handleMasterExport = async () => {
    setIsExporting(true);
    try {
      await generateMasterRosterPDF(students, grades, allClasses);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Student List
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Manage all student enrollments and records
            </p>
            {arrearsStudentIds.size > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                {arrearsStudentIds.size} {arrearsDisplayMonth} arrears
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setForceShowAll(true)}
            className="px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
          >
            <Users className="w-3.5 h-3.5" /> All students
          </button>
          <button
            onClick={handleMasterExport}
            disabled={isExporting || students.length === 0}
            className="px-5 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[11px] font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Layers className="w-3.5 h-3.5" />
            )}
            Export All Students
          </button>
          <button
            onClick={() => handleCollectPayment()}
            className="px-5 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[11px] font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
          >
            <CreditCard className="w-3.5 h-3.5" /> Collect Payment
          </button>
          <button
            onClick={handleAdd}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Enroll Student
          </button>
        </div>
      </div>

      {/* 🏛️ Grade Selection (Visible when no grade selected and not force showing all) */}
      {!selectedGradeId && !forceShowAll && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-10 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center text-primary mb-6 animate-bounce transition-all duration-1000">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">
              Select Academic Level
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mt-2">
              Please select a grade level to access the student directory and
              enrollment records.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <Skeleton
                    key={i}
                    variant="rect"
                    width="100%"
                    height="80px"
                    className="rounded-2xl"
                  />
                ))
              : grades.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGradeId(g.id)}
                    className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-primary hover:shadow-xl hover:shadow-primary/5 transition-all group flex flex-col items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-slate-800 tracking-tight">
                      {g.name}
                    </span>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
                      {g.studentCount || 0} Students
                    </span>
                  </button>
                ))}
          </div>
        </div>
      )}

      {/* 🏛️ Specialized Stats Header (Visible when grade selected or force show all) */}
      {(selectedGradeId || forceShowAll) && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedGradeId("");
                  setSelectedClassId("");
                  setForceShowAll(false);
                }}
                className="p-2 hover:bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400 hover:text-primary transition-all group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:translate-x-[-2px] transition-transform" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {forceShowAll
                    ? "Institutional Roster"
                    : `${activeGrade?.name} Directory`}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Academic Year 2026 • Verified Records
                </p>
              </div>
            </div>
            {filteredStudents.length > 0 && (
              <button
                onClick={handleExport}
                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:bg-primary hover:text-white hover:border-primary transition-all flex items-center gap-2 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> Export{" "}
                {activeClass ? "Class" : "Grade"} List
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, idx) => (
              <div
                key={idx}
                className={`bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-200 hover:border-primary/30 group shadow-sm`}
              >
                <div className="flex flex-col gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color.replace("text-", "bg-").split("-").slice(0, 2).join("-")}-50 ${card.color} transition-all shadow-sm`}
                  >
                    <card.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">
                      {card.title}
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary transition-colors">
                        {card.value}
                      </p>
                      <ArrowRight className="w-2.5 h-2.5 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Class Filter Bar */}
          <div className="flex flex-wrap gap-2 p-2 bg-slate-100 rounded-2xl border border-slate-200/50">
            <button
              onClick={() => setSelectedClassId("")}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedClassId === "" ? "bg-primary text-white shadow-lg" : "bg-white text-slate-400 hover:text-slate-600"}`}
            >
              All Students
            </button>
            {allClasses
              .filter((c) => c.gradeId === selectedGradeId)
              .map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedClassId === cls.id ? "bg-emerald-600 text-white shadow-lg" : "bg-white text-slate-400 hover:text-slate-600"}`}
                >
                  {cls.name}
                </button>
              ))}
          </div>
        </div>
      )}

      <StudentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }}
        onSuccess={() => {}}
        initialData={selectedStudent}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setPaymentStudentId(null);
        }}
        initialStudentId={paymentStudentId || ""}
        onSuccess={() => {}}
      />

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setStudentToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Student Record"
        message="This action will permanently remove all enrollment data, attendance history, and payment logs associated with this student from the cloud. This cannot be undone."
      />

      {(selectedGradeId || forceShowAll) && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showFilters ? "bg-primary/10 border-primary text-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Filter className="w-4 h-4" /> Filters
              {filterStatus && (
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex justify-between items-end gap-4 animate-in slide-in-from-top duration-300">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                  Account Status
                </label>
                <div className="flex gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Suspended</option>
                  </select>
                </div>
              </div>
              <button
                onClick={clearFilters}
                className="h-[38px] px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Clear All Filters
              </button>
            </div>
          )}

          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">
                      <Skeleton variant="text" width="80px" height="10px" />
                    </th>
                    <th className="px-6 py-4">
                      <Skeleton variant="text" width="60px" height="10px" />
                    </th>
                    <th className="px-6 py-4">
                      <Skeleton variant="text" width="70px" height="10px" />
                    </th>
                    <th className="px-6 py-4">
                      <Skeleton variant="text" width="50px" height="10px" />
                    </th>
                    <th className="px-6 py-4">
                      <Skeleton variant="text" width="40px" height="10px" />
                    </th>
                    <th className="px-6 py-4 text-right flex justify-end">
                      <Skeleton variant="text" width="30px" height="10px" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Skeleton
                            variant="circle"
                            width="40px"
                            height="40px"
                          />
                          <div className="space-y-2">
                            <Skeleton
                              variant="text"
                              width="120px"
                              height="14px"
                            />
                            <Skeleton
                              variant="text"
                              width="80px"
                              height="10px"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 space-y-2">
                        <Skeleton variant="text" width="100px" height="14px" />
                        <Skeleton variant="text" width="60px" height="10px" />
                      </td>
                      <td className="px-6 py-4 space-y-2">
                        <Skeleton variant="text" width="40px" height="14px" />
                        <div className="flex gap-2">
                          <Skeleton
                            variant="rect"
                            width="50px"
                            height="16px"
                            className="rounded"
                          />
                          <Skeleton
                            variant="rect"
                            width="50px"
                            height="16px"
                            className="rounded"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton variant="text" width="150px" height="14px" />
                      </td>
                      <td className="px-6 py-4">
                        <Skeleton
                          variant="rect"
                          width="70px"
                          height="24px"
                          className="rounded-md"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Skeleton
                            variant="rect"
                            width="32px"
                            height="32px"
                            className="rounded-lg"
                          />
                          <Skeleton
                            variant="rect"
                            width="32px"
                            height="32px"
                            className="rounded-lg"
                          />
                          <Skeleton
                            variant="rect"
                            width="32px"
                            height="32px"
                            className="rounded-lg"
                          />
                          <Skeleton
                            variant="rect"
                            width="32px"
                            height="32px"
                            className="rounded-lg"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Enrollments</th>
                    <th className="px-6 py-4">School</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map((student) => (
                      <tr
                        key={student.id}
                        className={`hover:bg-slate-50/50 transition-colors ${student.status === "inactive" ? "opacity-60 bg-slate-50/30" : ""}`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${student.status === "inactive" ? "bg-slate-200 text-slate-500" : "bg-primary/10 text-primary"}`}
                            >
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <button
                                onClick={() => openStudentProfile(student.id)}
                                className={`font-semibold text-left hover:text-primary transition-colors ${student.status === "inactive" ? "text-slate-500" : "text-slate-800"}`}
                              >
                                {student.name}
                              </button>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-xs text-slate-500">
                                  ID:{" "}
                                  {student.studentId ||
                                    student.id.substring(0, 6).toUpperCase()}
                                </p>
                                {arrearsStudentIds.has(student.id) &&
                                  student.status === "active" && (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                                      {arrearsDisplayMonth} arrears
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p
                            className={`${student.status === "inactive" ? "text-slate-400" : "text-slate-700"} font-medium`}
                          >
                            {student.parentPhone || student.phone}
                          </p>
                          <p className="text-xs text-slate-500">
                            {student.parentName}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-700">
                            {student.grade || "N/A"}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              {student.enrolledClasses?.length || 0} Class
                              {student.enrolledClasses?.length === 1
                                ? ""
                                : "es"}
                            </span>
                            <span className="text-[10px] bg-primary/5 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              {student.enrolledSubjects?.length || 0} Subject
                              {student.enrolledSubjects?.length === 1
                                ? ""
                                : "s"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {student.schoolName}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${student.status === "active" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                          >
                            {student.status === "active"
                              ? "Active"
                              : "Suspended"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCollectPayment(student.id)}
                              className="p-2 text-slate-400 hover:text-emerald-600 transition-colors hover:bg-emerald-50 rounded-lg"
                              title="Collect Payment"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleStatus(student)}
                              title={
                                student.status === "active"
                                  ? "Suspend Account"
                                  : "Restore Account"
                              }
                              className={`p-2 transition-colors rounded-lg ${student.status === "active" ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50" : "text-amber-600 hover:text-green-600 hover:bg-green-50"}`}
                            >
                              {student.status === "active" ? (
                                <Ban className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => openStudentProfile(student.id)}
                              className="p-2 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 rounded-lg"
                              title="View Full Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(student)}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors hover:bg-blue-50 rounded-lg"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmDelete(student.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        No students found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 bg-slate-50"></div>
        </div>
      )}
    </div>
  );
}
