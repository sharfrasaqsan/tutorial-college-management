"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
  deleteDoc,
  doc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Calendar,
  Download,
  ArrowUpRight,
  X,
  AlertTriangle,
  Trash2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { Payment, Student } from "@/types/models";
import Link from "next/link";
import { format } from "date-fns";
import toast from "react-hot-toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  generateStudentPaymentPDF,
  generatePaymentsReportPDF,
} from "@/lib/pdf-generator";
import {
  formatPaymentMonth,
  getPaymentCycleKey,
  isPaymentInCycle,
} from "@/lib/formatters";
import { useMemo } from "react";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  // Actions Logic
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [arrearsCount, setArrearsCount] = useState(0);
  const [calculatingArrears, setCalculatingArrears] = useState(false);

  // Use previous month for arrears
  const arrearsLabelDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  }, []);

  const arrearsDisplayMonth = useMemo(() => 
    formatPaymentMonth(getPaymentCycleKey(arrearsLabelDate)),
    [arrearsLabelDate]
  );

  const loadPayments = async () => {
    setLoading(true);
    try {
      const paymentsQuery = query(
        collection(db, "payments"),
        orderBy("createdAt", "desc"),
        limit(500),
      );
      
      const paymentSnap = await getDocs(paymentsQuery);
      const fetchedPayments = paymentSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Payment,
      );
      setPayments(fetchedPayments);
      setLoading(false); // Enable UI interaction early

      // Calculate Arrears in background
      calculateArrears(fetchedPayments);
    } catch (error) {
      console.error("Error loading payments", error);
      setLoading(false);
    }
  };

  const calculateArrears = async (fetchedPayments: Payment[]) => {
    setCalculatingArrears(true);
    try {
      const activeStudentsQuery = query(
        collection(db, "students"),
        where("status", "==", "active"),
      );
      const studentSnap = await getDocs(activeStudentsQuery);

      // Only consider previous month payments for arrears
      const prevMonthDate = new Date();
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
      const paidStudents = new Set(
        fetchedPayments
          .filter((payment) => {
            const status = (payment.status || "").toLowerCase();
            return (
              (status === "paid" || status === "partial") &&
              isPaymentInCycle(payment.month, prevMonthDate)
            );
          })
          .map((payment) => payment.studentId),
      );

      const activeStudents = studentSnap.docs.map(
        (studentDoc) =>
          ({ id: studentDoc.id, ...studentDoc.data() }) as Student,
      );
      
      const prevMonthYear = prevMonthDate.getFullYear();
      const prevMonthIdx = prevMonthDate.getMonth();

      const outstanding = activeStudents.filter((student) => {
        if (!student.createdAt) return false;
        const joinDate = (student.createdAt as any).toDate ? (student.createdAt as any).toDate() : new Date(student.createdAt as any);
        const joinYear = joinDate.getFullYear();
        const joinMonth = joinDate.getMonth();

        // Joined before or during previous month
        const joinedBeforeOrDuring = joinYear < prevMonthYear || (joinYear === prevMonthYear && joinMonth <= prevMonthIdx);
        
        return joinedBeforeOrDuring && !paidStudents.has(student.id);
      }).length;
      
      setArrearsCount(outstanding);
    } catch (error) {
      console.error("Arrears calculation failed", error);
    } finally {
      setCalculatingArrears(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleVerify = async (payment: Payment) => {
    try {
      await updateDoc(doc(db, "payments", payment.id), { status: "paid" });
      toast.success("Transaction verified successfully.");
      loadPayments();
    } catch {
      toast.error("Verification failed.");
    }
  };

  const handleDownload = (payment: Payment) => {
    generateStudentPaymentPDF(payment, payment.studentName, payment.studentId);
    toast.success("Receipt generated.");
  };

  const confirmDelete = (id: string) => {
    setPaymentToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "payments", paymentToDelete));
      toast.success("Transaction voided.");
      setIsDeleteOpen(false);
      setPaymentToDelete(null);
      loadPayments();
    } catch {
      toast.error("Process failed.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch = p.studentName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "" || p.status === filterStatus;
      const matchesMethod = filterMethod === "" || p.method === filterMethod;
      const matchesMonth = filterMonth === "" || p.month === filterMonth;

      return matchesSearch && matchesStatus && matchesMethod && matchesMonth;
    });
  }, [payments, searchTerm, filterStatus, filterMethod, filterMonth]);

  const clearFilters = () => {
    setFilterStatus("");
    setFilterMethod("");
    setFilterMonth("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const totalRevenue = useMemo(() => 
    payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments]
  );

  const currentMonth = format(new Date(), "MMMM");
  
  const monthlyRevenue = useMemo(() => 
    payments
      .filter((payment) => isPaymentInCycle(payment.month))
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments]
  );

  const unPaidCount = useMemo(() => 
    payments.filter((p) => !p.status || p.status !== "paid").length,
    [payments]
  );

  const statCards = useMemo(() => [
    {
      title: "Total Revenue",
      value: `LKR ${totalRevenue.toLocaleString()}`,
      icon: CreditCard,
      color: "text-emerald-500",
    },
    {
      title: `${currentMonth} Revenue`,
      value: `LKR ${monthlyRevenue.toLocaleString()}`,
      icon: Calendar,
      color: "text-blue-500",
    },
    {
      title: "Transactions",
      value: filteredPayments.length,
      icon: ArrowUpRight,
      color: "text-indigo-500",
    },
    {
      title: "Verification Req.",
      value: unPaidCount,
      icon: AlertTriangle,
      color: "text-orange-500",
    },
  ], [totalRevenue, monthlyRevenue, filteredPayments.length, unPaidCount, currentMonth]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Student Payments
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              View and manage all student payments
            </p>
            {arrearsCount > 0 && (
              <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                {arrearsCount} {arrearsDisplayMonth} arrears
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/payments/record"
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" /> Record Payment
          </Link>
        </div>
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
                  <p className="text-base font-bold text-slate-900 tracking-tight group-hover:text-primary transition-colors leading-none">
                    {loading ? "---" : card.value}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showFilters ? "bg-primary/10 border-primary text-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <Filter className="w-4 h-4" /> Filters
              {(filterStatus || filterMethod || filterMonth) && (
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
              )}
            </button>
            <button
              onClick={() => generatePaymentsReportPDF(filteredPayments)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 border-b border-slate-100 bg-slate-50/30 grid grid-cols-1 sm:grid-cols-4 gap-4 animate-in slide-in-from-top duration-300">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Method
              </label>
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Month
              </label>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full h-[38px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Clear All
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto min-h-[300px]">
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
                    <Skeleton variant="text" width="80px" height="10px" />
                  </th>
                  <th className="px-6 py-4">
                    <Skeleton variant="text" width="50px" height="10px" />
                  </th>
                  <th className="px-6 py-4">
                    <Skeleton variant="text" width="70px" height="10px" />
                  </th>
                  <th className="px-6 py-4">
                    <Skeleton variant="text" width="60px" height="10px" />
                  </th>
                  <th className="px-6 py-4 text-right flex justify-end">
                    <Skeleton variant="text" width="40px" height="10px" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4">
                      <Skeleton variant="text" width="60px" height="12px" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton variant="text" width="120px" height="14px" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton variant="text" width="100px" height="12px" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton variant="text" width="80px" height="12px" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton variant="text" width="100px" height="16px" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton
                        variant="rect"
                        width="50px"
                        height="18px"
                        className="rounded"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Skeleton
                        variant="rect"
                        width="60px"
                        height="20px"
                        className="ml-auto rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Type & Details</th>
                  <th className="px-6 py-4">For Month</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPayments.length > 0 ? (
                  paginatedPayments.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 uppercase">
                            {item.id.substring(0, 8)}
                          </span>
                          <span className="text-[10px] font-black uppercase text-slate-300 font-mono">
                            {item.method}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {item.studentName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded w-fit border ${item.subject === "Admission" ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"}`}
                          >
                            {item.subject === "Admission"
                              ? "Admission Fee"
                              : "Monthly Fee"}
                          </span>
                          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tight line-clamp-1">
                            {item.subjects?.join(", ") ||
                              item.subject ||
                              "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {formatPaymentMonth(item.month)}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900 tabular-nums">
                        LKR {item.amount?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${item.status === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {item.status || "Verified"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDownload(item)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 rounded-lg transition-all"
                            title="Download Receipt"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {item.status !== "paid" && (
                            <button
                              onClick={() => handleVerify(item)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Verify Payment"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => confirmDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="Void Transaction"
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
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500 font-medium"
                    >
                      No transactions found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs text-slate-500 font-medium tracking-tight">
              Showing{" "}
              <span className="text-slate-900 font-bold">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="text-slate-900 font-bold">
                {Math.min(currentPage * itemsPerPage, filteredPayments.length)}
              </span>{" "}
              of{" "}
              <span className="text-slate-900 font-bold">
                {filteredPayments.length}
              </span>{" "}
              results
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-white text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show current page, and up to 1 page around it
                    return Math.abs(p - currentPage) <= 1 || p === 1 || p === totalPages;
                  })
                  .map((p, idx, arr) => (
                    <div key={p} className="flex items-center gap-1">
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="text-slate-300 mx-1">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-slate-200 text-slate-600 hover:border-primary/30"}`}
                      >
                        {p}
                      </button>
                    </div>
                  ))}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="p-2 border border-slate-200 rounded-lg hover:bg-white text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setPaymentToDelete(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Void Transaction"
        message="Are you sure you want to void this transaction? This action will permanently remove the record from the ledger. Student enrollment status may be affected if this was an active fee payment."
      />
    </div>
  );
}
