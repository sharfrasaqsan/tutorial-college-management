"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { format } from "date-fns";
import { 
  User, 
  Mail, 
  Shield, 
  Camera, 
  Loader2, 
  CheckCircle, 
  Key,
  Smartphone,
  MapPin,
  Zap,
  Activity,
  Fingerprint,
  ShieldCheck,
  Server,
  Database,
  History,
  CreditCard,
  UserPlus
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { useDashboard } from "@/hooks/useDashboard";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const { stats, isLoading: dashLoading } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        setLoading(true);
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAdminData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
        toast.error("Failed to load secure profile data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        name: adminData.name,
        phone: adminData.phone || "",
        address: adminData.address || "",
        updatedAt: new Date(),
      });
      toast.success("Identity updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Cloud synchronization failed.");
    } finally {
      setSaving(false);
    }
  };

  const getJoinYear = () => {
    if (!adminData?.createdAt) return "2024";
    const raw = adminData.createdAt as any;
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    return format(date, "yyyy");
  };

  const getLastUpdateText = () => {
    if (!adminData?.updatedAt) return "Original Registry";
    const raw = adminData.updatedAt as any;
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    return `Update: ${format(date, "MMM dd, hh:mm a")}`;
  };

  if (loading || dashLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">
      
      {/* 🛡️ System Authority Header */}
      <div className="relative overflow-hidden rounded-[3rem] bg-white border border-slate-200/50 shadow-2xl shadow-emerald-100/20 p-1">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-50/50 rounded-full blur-[100px] -mr-64 -mt-64 transition-transform duration-1000"></div>
        <div className="bg-slate-50/50 rounded-[2.9rem] p-8 md:p-10 flex flex-col lg:flex-row items-center gap-10 relative z-10">
          
          <div className="relative group">
            <div className="w-40 h-40 rounded-[48px] overflow-hidden border-8 border-white shadow-2xl relative transition-transform duration-500 group-hover:scale-[1.02]">
              {adminData?.photoURL ? (
                <Image 
                  src={adminData.photoURL} 
                  alt="Profile" 
                  fill
                  className="object-cover" 
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                   <User className="w-16 h-16 text-slate-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer backdrop-blur-[2px]">
                <Camera className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-emerald-600 rounded-3xl border-4 border-white flex items-center justify-center shadow-xl rotate-12 group-hover:rotate-0 transition-transform">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
               <span className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-200">System Authority ID</span>
               <span className="px-4 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-[0.2em]">Global Administrator</span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
                {adminData?.name || "System Controller"}
              </h1>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 mt-4">
                <div className="flex items-center gap-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest bg-white/50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                   <Mail className="w-4 h-4 text-emerald-500" />
                   {user?.email}
                </div>
                <div className="flex items-center gap-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest bg-white/50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                   <ShieldCheck className="w-4 h-4 text-emerald-600" />
                   Root Privilege Access
                </div>
              </div>
            </div>
          </div>

          <div className="hidden xl:flex flex-col items-end gap-3 translate-y-4">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">Verification Status</p>
             <div className="px-6 py-4 bg-white/80 backdrop-blur-md border border-emerald-100 rounded-3xl shadow-xl shadow-emerald-100/20 flex items-center gap-4">
                <div className="w-2 h-12 bg-emerald-500 rounded-full animate-pulse"></div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Node Health</p>
                   <p className="text-sm font-black text-slate-900 leading-none">ROOT SECURE</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
           
           {/* 📝 Identity Management Section */}
           <div className="bg-white rounded-[3rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-emerald-600">
                       <Fingerprint className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">Administrative Registry</h3>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{getLastUpdateText()}</p>
                    </div>
                 </div>
              </div>
              
              <div className="p-10">
                <form onSubmit={handleUpdateProfile} className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 ml-1">Identity Display Name</label>
                         <div className="relative group/input">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-emerald-400 transition-colors" />
                            <input 
                               type="text" 
                               required
                               value={adminData?.name || ""}
                               onChange={(e) => setAdminData({...adminData, name: e.target.value})}
                               className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-[13px] text-slate-800 tracking-tight shadow-sm"
                            />
                         </div>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 ml-1">Direct Telemetry Line</label>
                         <div className="relative group/input">
                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-emerald-500 transition-colors" />
                            <input 
                               type="text" 
                               value={adminData?.phone || ""}
                               onChange={(e) => setAdminData({...adminData, phone: e.target.value})}
                               className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-[13px] text-slate-800 tabular-nums shadow-sm"
                            />
                         </div>
                      </div>

                      <div className="md:col-span-2 space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 ml-1">System Operational Address</label>
                         <div className="relative group/input">
                            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-emerald-500 transition-colors" />
                            <input 
                               type="text" 
                               value={adminData?.address || ""}
                               onChange={(e) => setAdminData({...adminData, address: e.target.value})}
                               className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-black text-[11px] text-slate-800 uppercase tracking-widest shadow-sm"
                            />
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-4">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-relaxed max-w-[300px]">
                         Updating display identifiers will propagate across all administrative audit trails instantly.
                      </p>
                      <button 
                        type="submit"
                        disabled={saving}
                        className="px-10 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-900 transition-all flex items-center gap-3 shadow-2xl shadow-emerald-200 disabled:opacity-50 active:scale-95"
                      >
                         {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Finalize Registry Push</>}
                      </button>
                   </div>
                </form>
              </div>
           </div>

           {/* 🔐 Credential Node */}
           <div className="bg-white rounded-[3rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-10 space-y-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Key className="w-6 h-6 outline-none" />
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">Authentication Schema</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Credential and access-key control</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="px-8 py-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-emerald-600 hover:border-emerald-500 transition-all duration-300 cursor-default">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-200 mb-1">Primary Access Key</p>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white transition-colors">{user?.email}</span>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-emerald-400 group-hover:text-white transition-all" />
                  </div>
                  
                  <div className="px-8 py-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-emerald-600 hover:border-emerald-500 transition-all duration-300 cursor-default">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-emerald-200 mb-1">System Privilege</p>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white transition-colors text-emerald-600">ROOT ADMIN</span>
                    </div>
                    <Zap className="w-5 h-5 text-emerald-400 group-hover:text-white transition-all" />
                  </div>
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           
           {/* 🛸 Operational Matrix Widget */}
           <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden flex flex-col justify-center shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
              <div className="relative z-10 space-y-8">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400">System Command</span>
                    <Server className="w-4 h-4 text-emerald-400" />
                 </div>
                 
                 <div className="space-y-5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                       <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Authority Link</span>
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> Active Controller
                       </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                       <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Institutional Scale</span>
                       <span className="text-[11px] font-black uppercase tracking-widest text-white">{stats?.totalStudents || 0} Students</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Registry Year</span>
                       <span className="text-[11px] font-black uppercase tracking-widest text-white">{getJoinYear()} Master</span>
                    </div>
                 </div>

                 <div className="pt-2">
                    <button className="w-full py-4 bg-white/10 border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                       Export Master Registry
                    </button>
                 </div>
              </div>
           </div>

           {/* 🛰️ Registry Traffic (Real Data) */}
           <div className="bg-white rounded-[3rem] border border-slate-200/60 p-8 shadow-xl shadow-slate-200/20 space-y-8">
              <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-800">
                    <History className="w-4 h-4 text-emerald-600" /> Registry Traffic
                 </h4>
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
              
              <div className="space-y-6 relative">
                 <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-100"></div>
                 {stats?.recentStudents?.length ? stats.recentStudents.slice(0, 4).map((student, i) => (
                    <div key={i} className="flex gap-5 items-start relative z-10">
                        <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shrink-0">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{student.name}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">New Admission • {student.grade}</p>
                        </div>
                        <UserPlus className="w-3.5 h-3.5 text-emerald-500 opacity-40 shrink-0" />
                    </div>
                 )) : (
                    <div className="py-6 text-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No recent admissions.</p>
                    </div>
                 )}
              </div>
           </div>

           {/* 🛰️ Monetary Feed (Real Data) */}
           <div className="bg-white rounded-[3rem] border border-slate-200/60 p-8 shadow-xl shadow-slate-200/20 space-y-8">
              <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-800">
                    <CreditCard className="w-4 h-4 text-emerald-600" /> Monetary Feed
                 </h4>
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
              
              <div className="space-y-6 relative">
                 <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-100"></div>
                 {stats?.monthlyPayments?.length ? stats.monthlyPayments.slice(0, 4).map((pay, i) => (
                    <div key={i} className="flex gap-5 items-start relative z-10">
                        <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shrink-0">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{pay.studentName}</p>
                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-1.5">+LKR {pay.amount.toLocaleString()}</p>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${pay.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                           {pay.status}
                        </div>
                    </div>
                 )) : (
                    <div className="py-6 text-center">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No recent payments.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
