"use client";

import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, collection, query, where, getDocs, Timestamp, orderBy, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  X, Phone, MapPin, 
  BookOpen, Calendar, Activity,
  Loader2, Award, Hash, Clock,
  Trash2, Download, ShieldCheck, GraduationCap,
  CreditCard, Users, QrCode
} from "lucide-react";
import { Student, Class, Payment } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import ConfirmModal from "@/components/ui/ConfirmModal";
import PaymentModal from "@/components/admin/PaymentModal";
import toast from "react-hot-toast";
import { generateStudentPaymentPDF, generateStudentIDCardPDF, generateStudentPaymentHistoryPDF } from "@/lib/pdf-generator";
import { format } from "date-fns";
import { formatTime } from "@/lib/formatters";
import QRCode from "qrcode";

interface StudentProfileModalProps {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentProfileModal({ studentId, isOpen, onClose }: StudentProfileModalProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<Class[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'financials' | 'administration'>('overview');
  const [deletingPayment, setDeletingPayment] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [paymentToDeleteId, setPaymentToDeleteId] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [generatingId, setGeneratingId] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const loadStudentData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Student Basic Info
      const sDoc = await getDoc(doc(db, "students", studentId));
      if (!sDoc.exists()) {
        setLoading(false);
        return;
      }
      const sData = { id: sDoc.id, ...sDoc.data() } as Student;
      setStudent(sData);

      // 2. Fetch Enrolled Classes
      if (sData.enrolledClasses && sData.enrolledClasses.length > 0) {
        const classPromises = sData.enrolledClasses.map(cid => getDoc(doc(db, "classes", cid)));
        const classSnaps = await Promise.all(classPromises);
        setEnrolledClasses(classSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Class)));
      }

      // 3. Fetch Payment History
      const payQuery = query(
        collection(db, "payments"), 
        where("studentId", "==", studentId),
        orderBy("createdAt", "desc")
      );
      const paySnap = await getDocs(payQuery);
      setPaymentHistory(paySnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

      // 4. Generate QR Code
      try {
        const qrData = await QRCode.toDataURL(sData.id, {
          margin: 1,
          color: {
            dark: "#1e293b",
            light: "#ffffff"
          }
        });
        setQrCodeUrl(qrData);
      } catch (e) {
        console.error("QR Generation failed", e);
      }

    } catch (error) {
      console.error("Error loading student profile:", error);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (isOpen && studentId) {
      loadStudentData();
    }
  }, [isOpen, studentId, loadStudentData]);

  const openDeleteConfirm = (payId: string) => {
    setPaymentToDeleteId(payId);
    setShowDeleteConfirm(true);
  };

  const handleDeletePayment = async () => {
    if (!paymentToDeleteId) return;
    
    setDeletingPayment(paymentToDeleteId);
    try {
      await deleteDoc(doc(db, "payments", paymentToDeleteId));
      setPaymentHistory(prev => prev.filter(p => p.id !== paymentToDeleteId));
      toast.success("Transaction purged from ledger.");
      setShowDeleteConfirm(false);
      setPaymentToDeleteId(null);
    } catch (error) {
      toast.error("Process failed.");
    } finally {
      setDeletingPayment(null);
    }
  };

  const handleDownloadReceipt = async (payment: any) => {
    try {
      // Re-format items if missing (for older records)
      const paymentToPrint = {
        ...payment,
        createdAt: payment.createdAt instanceof Timestamp ? payment.createdAt.toDate() : new Date(payment.createdAt)
      };
      await generateStudentPaymentPDF(paymentToPrint, student?.name, student?.studentId);
      toast.success("Receipt generated.");
    } catch (error) {
      toast.error("Failed to generate PDF.");
    }
  };

  const handleDownloadIdCard = async () => {
    if (!student || !qrCodeUrl) return;
    setGeneratingId(true);
    try {
      await generateStudentIDCardPDF(student, qrCodeUrl);
      toast.success("ID Card generated.");
    } catch (error) {
      toast.error("Generation failed.");
    } finally {
      setGeneratingId(false);
    }
  };

  const handleDownloadHistory = async () => {
    if (!student || paymentHistory.length === 0) return;
    try {
      await generateStudentPaymentHistoryPDF(paymentHistory, student);
      toast.success("Payment history statement generated.");
    } catch (error) {
      toast.error("Failed to generate statement.");
    }
  };

  if (!isOpen) return null;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return format(d, "MMM dd, yyyy");
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* Header Segment */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : student?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {loading ? <Skeleton variant="text" width="180px" height="24px" /> : student?.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> ID: {loading ? "..." : student?.studentId || student?.id.substring(0,8).toUpperCase()}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${student?.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {loading ? "..." : student?.status}
                         </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg active:scale-95"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Collect Fee
                </button>
                <div className="w-[1px] h-6 bg-slate-100 mx-1"></div>
                <button 
                    onClick={handleDownloadIdCard}
                    disabled={generatingId || !student}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 disabled:opacity-50"
                >
                    {generatingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                    Download ID
                </button>
                <button 
                    onClick={onClose}
                    className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Navigation Bar */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0 scrollbar-hide overflow-x-auto">
            {(['overview', 'classes', 'financials', 'administration'] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize shrink-0 ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab === 'overview' ? 'Overview' : tab === 'classes' ? 'Enrollment' : tab === 'financials' ? 'Payments' : 'Profile'}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all" />
                    )}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
            {loading ? (
                <div className="space-y-6">
                    <Skeleton variant="rect" width="100%" height="150px" className="rounded-2xl" />
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton variant="rect" width="100%" height="80px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="80px" className="rounded-xl" />
                    </div>
                </div>
            ) : student && (
                <div className="animate-in fade-in duration-500">
                    {activeTab === 'overview' && (
                        <div className="space-y-10">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Grade Level', value: student.grade || 'N/A', icon: GraduationCap, color: 'bg-primary/5 text-primary border-primary/10' },
                                    { label: 'Classes', value: enrolledClasses.length, icon: BookOpen, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                    { label: 'Payments', value: paymentHistory.length, icon: CreditCard, color: 'bg-indigo-50 text-indigo-500 border-indigo-100' },
                                    { label: 'Enrollment', value: formatDate(student.createdAt), icon: Calendar, color: 'bg-slate-50 text-slate-500 border-slate-200' },
                                ].map((stat, i) => (
                                    <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${stat.color}`}>
                                        <stat.icon className="w-4 h-4" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-0.5">{stat.label}</p>
                                            <p className="text-base font-bold tracking-tight">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Contact & Personal</h4>
                                        <div className="space-y-6">
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Phone className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Parent / Emergency</p>
                                                    <p className="text-sm font-semibold text-slate-800 tracking-tight">{student.parentPhone || 'N/A'}</p>
                                                    {student.phone && (
                                                        <p className="text-[9px] font-bold text-slate-400 mt-1">Student: {student.phone}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><Users className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Parent Name</p>
                                                    <p className="text-sm font-semibold text-slate-800">{student.parentName || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-4">
                                                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"><MapPin className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Home Address</p>
                                                    <p className="text-sm font-semibold text-slate-800 leading-relaxed">{student.address || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">School Info</h4>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Day School</span>
                                                <span className="text-xs font-bold text-slate-800">{student.schoolName || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                                                <span className="text-xs font-semibold text-slate-500">Academic Status</span>
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 rounded uppercase tracking-widest">Active</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div>
                                         <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Digital Identity</h4>
                                         <div className="p-5 rounded-3xl border border-slate-100 bg-white flex flex-col items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
                                              {qrCodeUrl ? (
                                                  <div className="p-3 border-4 border-slate-50 rounded-2xl bg-white">
                                                      <img src={qrCodeUrl} alt="Student QR" className="w-32 h-32" />
                                                  </div>
                                              ) : (
                                                  <div className="w-32 h-32 bg-slate-50 animate-pulse rounded-2xl" />
                                              )}
                                              <div className="text-center">
                                                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Institutional Hash</p>
                                                  <p className="text-[8px] font-bold text-slate-400 font-mono">{student.id.toUpperCase()}</p>
                                              </div>
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'classes' && (
                        <div className="space-y-6 animate-in slide-in-from-right-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Course Enrollment</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{enrolledClasses.length} Active Units</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {enrolledClasses.length > 0 ? enrolledClasses.map((cls) => (
                                    <div key={cls.id} className="p-5 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all bg-white group flex flex-col justify-between min-h-[140px]">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-all flex items-center justify-center">
                                                    <BookOpen className="w-5 h-5" />
                                                </div>
                                                <div className="px-2 py-0.5 bg-slate-50 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest">Verified</div>
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{cls.name}</h5>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{cls.subject} • {cls.grade}</p>
                                            </div>

                                            {cls.schedules && cls.schedules.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-50 space-y-2">
                                                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Class Timetable</p>
                                                    {cls.schedules.map((sched, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-slate-50/50 rounded-lg px-3 py-2 border border-slate-100/50">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
                                                                <span className="text-[10px] font-bold text-slate-600 capitalize">{sched.dayOfWeek}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                                                                    <Clock className="w-3 h-3" />
                                                                    {formatTime(sched.startTime)} - {formatTime(sched.endTime)}
                                                                </div>
                                                                {sched.room && (
                                                                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 border-l border-slate-200 pl-3">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {sched.room}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                        <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No active enrollment units detected</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6 animate-in slide-in-from-left-10 duration-500">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Fee Collection History</h4>
                                    <button 
                                        onClick={handleDownloadHistory}
                                        className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100"
                                    >
                                        <Download className="w-3 h-3" />
                                        Download History
                                    </button>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 uppercase tracking-widest">{paymentHistory.length} Transactions</span>
                             </div>
                             <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Financial Cycle</th>
                                            <th className="px-6 py-4">Subjects</th>
                                            <th className="px-6 py-4 text-right">Settlement</th>
                                            <th className="px-6 py-4 text-right pr-8 whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paymentHistory.length > 0 ? paymentHistory.map((pay) => (
                                            <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors group/row">
                                                <td className="px-6 py-5">
                                                    <p className="font-bold text-slate-700 capitalize leading-none">{pay.month}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{formatDate(pay.createdAt)}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{pay.subject || 'Standard'}</span>
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums">LKR {pay.amount?.toLocaleString()}</td>
                                                <td className="px-6 py-5 text-right pr-6 whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleDownloadReceipt(pay)}
                                                            className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                            title="Download Receipt"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => openDeleteConfirm(pay.id)}
                                                            disabled={deletingPayment === pay.id}
                                                            className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                                            title="Delete Transaction"
                                                        >
                                                            {deletingPayment === pay.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-medium italic">No financial footprints detected in cloud storage.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    )}

                    {activeTab === 'administration' && (
                        <div className="space-y-10 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Security & Identity</h4>
                                        <div className="space-y-4">
                                            <div className="p-4 rounded-xl border border-slate-100 bg-emerald-50/30 flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Award className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-none mb-1">Status Verified</p>
                                                    <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-widest">Authentic Record</p>
                                                </div>
                                            </div>
                                            <div className="p-4 rounded-xl border border-slate-100 bg-blue-50/30 flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><ShieldCheck className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800 leading-none mb-1">Managed Resource</p>
                                                    <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-widest">Level: {student.grade || 'Standard'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Archive Footprint</h4>
                                        <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-4">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Registration Index</span>
                                                <span className="font-bold text-slate-800">{formatDate(student.createdAt)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-500 flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Last Modified</span>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">Cloud Synced</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-300" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-0.5">Note: Secure archive record</p>
            </div>
            <button 
                onClick={onClose}
                className="px-8 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all shadow-xl active:scale-95"
            >
                Close Profile
            </button>
        </div>
      </div>

      <ConfirmModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePayment}
        loading={!!deletingPayment}
        title="Purge Transaction"
        message="This will permanently remove this payment record from the institutional ledger. This action is irreversible and will affect monthly revenue summaries."
        confirmText="Yes, Purge Record"
      />

      {student && (
        <PaymentModal 
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          initialStudentId={studentId}
          onSuccess={() => {
            loadStudentData();
            setIsPaymentModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
