"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  X, User, Mail, Phone, MapPin, School, GraduationCap, 
  BookOpen, Clock, Calendar, CreditCard, Activity,
  ChevronRight, ArrowUpRight, Loader2, Hash, History,
  QrCode, Download
} from "lucide-react";
import { Student, Class, Payment } from "@/types/models";
import Skeleton from "@/components/ui/Skeleton";
import PaymentModal from "./PaymentModal";
import QRCode from "qrcode";
import { generateStudentIDCardPDF } from "@/lib/pdf-generator";

interface StudentProfileModalProps {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StudentProfileModal({ studentId, isOpen, onClose }: StudentProfileModalProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<Class[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'financials' | 'history'>('overview');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>("");

  useEffect(() => {
    if (isOpen && studentId) {
      loadStudentData();
    }
  }, [isOpen, studentId]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      const stdDoc = await getDoc(doc(db, "students", studentId));
      if (!stdDoc.exists()) {
        setLoading(false);
        return;
      }
      const stdData = { id: stdDoc.id, ...stdDoc.data() } as Student;
      setStudent(stdData);

      // 🔳 Generate QR Code (Verification URL or Internal ID)
      const verifyUrl = `https://smart-academy-portal.vercel.app/verify/student/${stdData.id}`;
      const qrData = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 400,
        color: {
            dark: '#1e293b', 
            light: '#ffffff'
        }
      });
      setQrCodeData(qrData);

      if (stdData.enrolledClasses && stdData.enrolledClasses.length > 0) {
        const classPromises = stdData.enrolledClasses.map(cid => getDoc(doc(db, "classes", cid)));
        const classSnaps = await Promise.all(classPromises);
        setEnrolledClasses(classSnaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as Class)));
      } else {
        setEnrolledClasses([]);
      }

      const payQuery = query(
        collection(db, "payments"), 
        where("studentId", "==", studentId),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const paySnap = await getDocs(payQuery);
      setRecentPayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));

    } catch (error) {
      console.error("Error loading student profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-primary text-xl font-bold">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : student?.name.charAt(0)}
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        {loading ? <Skeleton variant="text" width="180px" height="24px" /> : student?.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> {loading ? "..." : (student?.studentId || "STD-101")}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider ${student?.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {loading ? "..." : student?.status}
                         </span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {!loading && student && (
                    <>
                        <button 
                            onClick={() => generateStudentIDCardPDF(student, qrCodeData)}
                            className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                        >
                            <QrCode className="w-3.5 h-3.5" />
                            Download ID Card
                        </button>
                        <button 
                            onClick={() => setIsPaymentOpen(true)}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-2"
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            Quick Pay
                        </button>
                    </>
                )}
                <button 
                    onClick={onClose}
                    className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* Professional Navigation Bar */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1">
            {(['overview', 'academics', 'financials', 'history'] as const).map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab === 'overview' ? 'Overview' : tab === 'academics' ? 'Classes' : tab === 'financials' ? 'Payments' : 'History'}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
                    )}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
            {loading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                        <Skeleton variant="rect" width="100%" height="100px" className="rounded-xl" />
                    </div>
                    <Skeleton variant="rect" width="100%" height="300px" className="rounded-xl" />
                </div>
            ) : student && (
                <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-10">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Grade Level', value: student.grade || 'N/A', icon: GraduationCap, color: 'bg-blue-50 text-blue-600' },
                                    { label: 'Subjects', value: student.enrolledSubjects?.length || 0, icon: BookOpen, color: 'bg-indigo-50 text-indigo-600' },
                                    { label: 'Classes', value: student.enrolledClasses?.length || 0, icon: Clock, color: 'bg-emerald-50 text-emerald-600' },
                                    { label: 'Started On', value: formatDate(student.createdAt), icon: Calendar, color: 'bg-slate-50 text-slate-600' },
                                ].map((stat, i) => (
                                    <div key={i} className="p-4 rounded-xl border border-slate-100 flex flex-col gap-2">
                                        <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center`}>
                                            <stat.icon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                                            <p className="text-base font-bold text-slate-800">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                                {/* Informational Blocks */}
                                <div className="md:col-span-8 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-8">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Contact Details</h4>
                                            <div className="space-y-5">
                                                <div className="flex items-start gap-4">
                                                    <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-medium mb-0.5">Phone Number</p>
                                                        <p className="text-sm font-semibold text-slate-700">{student.phone || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-medium mb-0.5">Home Address</p>
                                                        <p className="text-sm font-semibold text-slate-700 leading-relaxed">{student.address || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <School className="w-4 h-4 text-slate-400 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-medium mb-0.5">School</p>
                                                        <p className="text-sm font-semibold text-slate-700">{student.schoolName || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Guardian Profile</h4>
                                            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 space-y-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-medium mb-0.5">Full Name</p>
                                                        <p className="text-sm font-bold text-slate-800">{student.parentName || 'N/A'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                                        <Phone className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-400 font-medium mb-0.5">Phone Number</p>
                                                        <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{student.parentPhone || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* QR Code Identity Widget */}
                                <div className="md:col-span-4 flex flex-col items-center">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 w-full text-center md:text-left">Digital Identity</h4>
                                    <div className="p-6 rounded-[2rem] bg-white border border-slate-100 shadow-xl shadow-slate-100/50 flex flex-col items-center gap-4 group">
                                        <div className="relative p-2 bg-slate-50 rounded-2xl border border-slate-100 group-hover:scale-[1.02] transition-transform duration-500">
                                            {qrCodeData ? (
                                                <img src={qrCodeData} alt="Verification QR" className="w-32 h-32 md:w-40 md:h-40" />
                                            ) : (
                                                <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
                                                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Verify Enrollment</p>
                                            <p className="text-[9px] font-medium text-slate-400 max-w-[150px]">Scan to authenticate student status via the official portal</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'academics' && (
                        <div className="space-y-6">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Enrolled Classes</h4>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full uppercase tracking-widest leading-none border border-slate-100">{enrolledClasses.length} Classes</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {enrolledClasses.length > 0 ? enrolledClasses.map((cls) => (
                                    <div key={cls.id} className="p-5 rounded-2xl border border-slate-100 hover:border-slate-300 transition-all bg-white group flex flex-col justify-between min-h-[140px]">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase leading-none">{cls.subject}</p>
                                                <ArrowUpRight className="w-4 h-4 text-slate-200 group-hover:text-primary transition-colors" />
                                            </div>
                                            <h5 className="font-bold text-slate-800 text-lg">{cls.name}</h5>
                                            <p className="text-xs font-medium text-slate-400 mt-1">{cls.grade}</p>
                                        </div>
                                        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-50">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{cls.schedules?.[0]?.dayOfWeek || 'Schedule Pending'}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                        <p className="text-sm text-slate-400 font-medium">No recorded enrollments found at this time.</p>
                                    </div>
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div className="space-y-6">
                             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Payments</h4>
                             </div>
                             <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Ref Number</th>
                                            <th className="px-6 py-4">Month</th>
                                            <th className="px-6 py-4">Method</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentPayments.length > 0 ? recentPayments.map((pay) => (
                                            <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-5 font-mono text-xs text-slate-600 font-bold tracking-tight">#{pay.id.substring(0,10).toUpperCase()}</td>
                                                <td className="px-6 py-5 text-slate-600 font-semibold capitalize">{pay.month}</td>
                                                <td className="px-6 py-5">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase tracking-widest border border-slate-200">{pay.method}</span>
                                                </td>
                                                <td className="px-6 py-5 text-right font-bold text-slate-800">LKR {pay.amount.toLocaleString()}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">Record vault empty.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-6">
                             <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-4">Update History</h4>
                            <div className="relative pl-6 space-y-8 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-slate-100">
                                <div className="relative">
                                    <div className="absolute -left-[1.75rem] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-primary"></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 leading-none">Student Registered</p>
                                        <p className="text-[11px] text-slate-400 mt-1.5 font-medium leading-relaxed">Student added to the system.</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-3 font-semibold uppercase tracking-widest group bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(student.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[1.75rem] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-slate-300"></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-700 leading-none">Grade Set</p>
                                        <p className="text-[11px] text-slate-400 mt-1.5 font-medium leading-relaxed">Added to {student.grade || 'unspecified'} grade.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Professional Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-300" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none pt-0.5">Details Checked</p>
            </div>
            <button 
                onClick={onClose}
                className="px-8 py-2.5 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-slate-900 transition-all shadow-sm active:scale-95"
            >
                Close Profile
            </button>
        </div>
      </div>

      <PaymentModal 
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        initialStudentId={studentId}
        onSuccess={loadStudentData}
      />
    </div>
  );
}
