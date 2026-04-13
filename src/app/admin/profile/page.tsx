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
  Smartphone,
  MapPin,
  Zap,
  Activity,
  Fingerprint,
  Briefcase,
  History,
  Lock,
  Edit3,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import Skeleton from "@/components/ui/Skeleton";
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
        toast.error("Cloud synchronization failed.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !adminData) return;
    setSaving(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        name: adminData.name || "",
        phone: adminData.phone || "",
        address: adminData.address || "",
        updatedAt: new Date(),
      });
      toast.success("Identity updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to save changes.");
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

  if (loading || dashLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center py-4">
             <Skeleton variant="text" width="200px" height="32px" />
             <Skeleton variant="rect" width="120px" height="40px" className="rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
           <Skeleton variant="rect" className="md:col-span-4 rounded-[3rem]" height="600px" />
           <Skeleton variant="rect" className="md:col-span-8 rounded-[3rem]" height="600px" />
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-[1400px] mx-auto">
      
      {/* 🏛️ Mission Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Profile</h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider leading-none">
            Identity Hub • <span className="text-emerald-600 font-bold">{adminData?.name || "System Controller"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
           <button 
             disabled={true}
             className="px-5 py-2.5 bg-slate-50 text-slate-400 rounded-xl text-[11px] font-bold border border-slate-100 flex items-center gap-2 opacity-50 cursor-not-allowed"
           >
             <Shield className="w-3.5 h-3.5" /> Root Verified
           </button>
           <button 
             onClick={handleUpdateProfile}
             disabled={saving}
             className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
           >
             {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle className="w-3.5 h-3.5" /> Save Changes</>}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* 🏅 Profile Identity Card (Left - 4 cols) */}
        <div className="lg:col-span-4 space-y-8">
            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-100/50 p-8 flex flex-col items-center text-center relative overflow-hidden group hover:border-emerald-100 transition-all duration-700">
                <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50/50 rounded-full blur-[60px] -mr-24 -mt-24 group-hover:bg-emerald-100/50 transition-all"></div>
                
                <div className="relative mb-8 pt-4">
                    <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-8 border-slate-50 transition-all duration-500 group-hover:scale-[1.05] group-hover:rotate-3 shadow-xl relative">
                        {adminData?.photoURL ? (
                            <Image src={adminData.photoURL} alt="Profile" fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                <User className="w-12 h-12 text-slate-300" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-emerald-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer backdrop-blur-[2px]">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-emerald-600 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-all">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                </div>

                <div className="space-y-4 w-full relative z-10">
                     <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none mb-2">{adminData?.name}</h2>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm inline-block uppercase">Global Administrator</span>
                     </div>
                     
                     <div className="flex flex-col gap-3 pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 group/item hover:bg-white hover:border-emerald-100 transition-all">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 group-hover/item:text-emerald-600 shadow-sm transition-colors">
                                <Mail className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] font-black text-slate-600 truncate uppercase tracking-wider">{user?.email}</span>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50 group/item hover:bg-white hover:border-emerald-100 transition-all">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 group-hover/item:text-emerald-600 shadow-sm transition-colors">
                                <Smartphone className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] font-black text-slate-600 tabular-nums">{adminData?.phone || "Private Connection"}</span>
                        </div>
                     </div>

                     <div className="pt-4 flex items-center justify-center gap-2">
                        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Identity ID: {user?.uid?.substring(0,8).toUpperCase()}</p>
                     </div>
                </div>
            </div>

            {/* Verification Widget */}
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden flex flex-col justify-center shadow-2xl hover:scale-[1.02] transition-transform duration-500 group/secure">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between uppercase tracking-wider text-[9px] font-black text-emerald-400">
                        <span>Terminal Access Status</span>
                        <Fingerprint className="w-4 h-4 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-black text-white tracking-wider">ROOT SECURE</p>
                            <span className="text-[10px] font-bold text-emerald-400">Verified Node</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="w-full h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 group-hover/secure:border-emerald-500/20 transition-all">
                         <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xl shadow-emerald-900/20">
                            <Lock className="w-3.5 h-3.5" />
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-emerald-400 tracking-wider leading-none mb-1">Access Control</p>
                            <p className="text-[10px] font-black text-white italic">Administrator</p>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 📚 Identity & Administrative Grid (Right - 8 cols) */}
        <div className="lg:col-span-8 space-y-8">
            

            {/* Administrative Registry Form */}
            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-100/40 relative overflow-hidden flex flex-col group/form hover:border-emerald-100 transition-all duration-700">
                <div className="px-10 py-10 border-b border-slate-50 flex items-center justify-between bg-white relative">
                    <div className="flex items-center gap-5">
                        <div className="w-1.5 h-10 bg-emerald-600 rounded-full group-hover/form:scale-y-110 transition-transform shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                        <div>
                            <h3 className="font-black text-slate-800 tracking-wider uppercase text-xs">Profile Details</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Update your details</p>
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <Edit3 className="w-6 h-6" />
                    </div>
                </div>

                <div className="p-10">
                    <form onSubmit={handleUpdateProfile} className="space-y-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                            {/* Assigned Identity (Read Only) */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                                <div className="relative group/input">
                                    <User className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-emerald-400 transition-colors" />
                                    <input 
                                        type="text" 
                                        required
                                        value={adminData?.name || ""}
                                        onChange={(e) => setAdminData({...adminData, name: e.target.value})}
                                        className="w-full pl-8 pr-4 py-3 bg-transparent border-b border-slate-100 focus:border-emerald-600 font-bold text-sm text-slate-800 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Contact Handset */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">Phone Number</label>
                                <div className="relative group/input">
                                    <Smartphone className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-emerald-400 transition-colors" />
                                    <input 
                                        type="text" 
                                        value={adminData?.phone || ""}
                                        onChange={(e) => setAdminData({...adminData, phone: e.target.value})}
                                        placeholder="07x xxxx xxx"
                                        className="w-full pl-8 pr-4 py-3 bg-transparent border-b border-slate-100 focus:border-emerald-600 font-bold text-sm text-slate-800 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Residential Address */}
                            <div className="md:col-span-2 space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1">Home Address</label>
                                <div className="relative group/input">
                                    <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-emerald-400 transition-colors" />
                                    <input 
                                        type="text" 
                                        value={adminData?.address || ""}
                                        onChange={(e) => setAdminData({...adminData, address: e.target.value})}
                                        placeholder="Enter your administrative location"
                                        className="w-full pl-8 pr-4 py-3 bg-transparent border-b border-slate-100 focus:border-emerald-600 font-bold text-sm text-slate-800 uppercase outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                     
                    </form>
                </div>
            </div>

            {/* System Metrics */}
            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-100/40 p-10 flex flex-col group/capacity hover:border-emerald-100 transition-all duration-700">
                <div className="flex items-center gap-5 mb-10">
                    <div className="w-1.5 h-10 bg-emerald-600 rounded-full group-hover/capacity:scale-y-110 transition-transform shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                    <div>
                        <h3 className="font-black text-slate-800 tracking-wider uppercase text-xs">System Summary</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Institutional statistics at a glance</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="px-6 py-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-emerald-600 hover:border-emerald-600 transition-all duration-300">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider group-hover:text-emerald-200 transition-colors">Institutional Scale</span>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-white transition-colors">{stats?.totalStudents || 0} Registered Students</span>
                        </div>
                        <Activity className="w-4 h-4 text-emerald-400 group-hover:text-white transition-all shadow-sm" />
                    </div>
                    <div className="px-6 py-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-emerald-600 hover:border-emerald-600 transition-all duration-300">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider group-hover:text-emerald-200 transition-colors">Faculty Reach</span>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-white transition-colors">{stats?.totalTeachers || 0} Active Teachers</span>
                        </div>
                        <Briefcase className="w-4 h-4 text-emerald-400 group-hover:text-white transition-all shadow-sm" />
                    </div>
                    <div className="px-6 py-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-emerald-600 hover:border-emerald-600 transition-all duration-300">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider group-hover:text-emerald-200 transition-colors">Academic Matrix</span>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-white transition-colors">{stats?.activeClassesCount || 0} Active Classes</span>
                        </div>
                        <Zap className="w-4 h-4 text-emerald-400 group-hover:text-white transition-all shadow-sm" />
                    </div>
                    <div className="px-6 py-5 bg-slate-50/50 border border-slate-100 rounded-2xl flex items-center justify-between group hover:bg-emerald-600 hover:border-emerald-600 transition-all duration-300">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider group-hover:text-emerald-200 transition-colors">Operational Since</span>
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-white transition-colors">{getJoinYear()} Master Node</span>
                        </div>
                        <History className="w-4 h-4 text-emerald-400 group-hover:text-white transition-all shadow-sm" />
                    </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
