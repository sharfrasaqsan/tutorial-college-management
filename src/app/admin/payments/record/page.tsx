"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CreditCard, Search, ChevronRight, Calendar, Receipt } from "lucide-react";
import { Student } from "@/types/models";
import toast from "react-hot-toast";

export default function RecordPaymentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: "",
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    method: "cash",
    description: "Monthly School Fee"
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadStudents() {
      try {
        const q = query(collection(db, "students"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      } catch (error) {
        console.error("Error loading students", error);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.phone || "").includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return toast.error("Please select a student first");
    if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) return toast.error("Please enter a valid amount");

    setSubmitting(true);
    try {
      const dupQuery = query(
        collection(db, "payments"),
        where("studentId", "==", selectedStudent.id),
        where("month", "==", paymentData.month)
      );
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        toast.error(`A payment for ${selectedStudent.name} for the month of ${paymentData.month} already exists.`);
        setSubmitting(false);
        return;
      }

      await addDoc(collection(db, "payments"), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        amount: parseFloat(paymentData.amount),
        month: paymentData.month,
        method: paymentData.method,
        description: paymentData.description,
        createdAt: serverTimestamp(),
        status: "paid"
      });
      
      toast.success("Payment recorded successfully!");
      setPaymentData({ ...paymentData, amount: "" });
      setSelectedStudent(null);
    } catch (error) {
      console.error("Error generating payment record", error);
      toast.error("Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Record Fee Payment</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-widest">
            Process student fee transactions
          </p>
        </div>
        <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-bold uppercase tracking-widest">Live Transaction</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search student..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="p-4 animate-pulse"><div className="h-4 bg-slate-100 rounded w-2/3"></div></div>)
            ) : filteredStudents.length > 0 ? filteredStudents.map((s) => (
              <button 
                key={s.id}
                onClick={() => setSelectedStudent(s)}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between group ${selectedStudent?.id === s.id ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
              >
                <div>
                  <p className="font-semibold text-slate-800 text-sm group-hover:text-primary transition-colors">{s.name}</p>
                  <p className="text-[10px] text-slate-500">{s.phone}</p>
                </div>
                {selectedStudent?.id === s.id && <ChevronRight className="w-4 h-4 text-primary" />}
              </button>
            )) : (
              <p className="p-8 text-center text-xs text-slate-500">No students found.</p>
            )}
          </div>
        </div>

        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-hidden">
          {selectedStudent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-500">Parent: {selectedStudent.parentName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Payment Month</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="month"
                      value={paymentData.month}
                      onChange={(e) => setPaymentData({ ...paymentData, month: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Amount (LKR)</label>
                  <div className="relative text-lg font-bold">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">Rs.</span>
                    <input 
                      type="number"
                      required
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-primary transition-all outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['cash', 'card', 'bank'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentData({ ...paymentData, method: m })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize border-2 transition-all ${paymentData.method === m ? 'border-primary bg-primary text-white shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Description / Note</label>
                <textarea 
                  rows={2}
                  value={paymentData.description}
                  onChange={(e) => setPaymentData({ ...paymentData, description: e.target.value })}
                  placeholder="Additional details..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-70"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" /> Confirm Payment
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-100">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 animate-bounce transition-all duration-1000">
                <Receipt className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Select a Student</h3>
              <p className="text-sm text-slate-500 max-w-xs">Please Search and click on a student from the sidebar to record their fee payment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
