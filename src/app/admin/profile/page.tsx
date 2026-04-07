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
  Clock, 
  Camera, 
  Loader2, 
  CheckCircle, 
  Key,
  Smartphone,
  MapPin,
  Calendar,
  Zap,
  Activity
} from "lucide-react";
import toast from "react-hot-toast";

export default function AdminProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminData, setAdminData] = useState<any>(null);

  useEffect(() => {
    async function fetchAdminData() {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAdminData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
        toast.error("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }
    fetchAdminData();
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
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const getJoinYear = () => {
    if (!adminData?.createdAt) return "2024";
    const date = adminData.createdAt.toDate ? adminData.createdAt.toDate() : new Date(adminData.createdAt);
    return format(date, "yyyy");
  };

  const getLastUpdateText = () => {
    if (!adminData?.updatedAt) return "Never updated";
    const date = adminData.updatedAt.toDate ? adminData.updatedAt.toDate() : new Date(adminData.updatedAt);
    return `Update: ${format(date, "MMM dd, hh:mm a")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header Profile Card */}
      <div className="relative bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden p-8 flex flex-col md:flex-row items-center gap-8 text-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -ml-24 -mb-24"></div>

        <div className="relative group">
          <div className="w-32 h-32 rounded-[40px] bg-slate-100 flex items-center justify-center border-4 border-white shadow-xl relative overflow-hidden">
            {adminData?.photoURL ? (
              <img src={adminData.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-slate-300" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="text-center md:text-left space-y-2 flex-1">
          <h2 className="text-3xl font-black tracking-tight">{adminData?.name || "System Admin"}</h2>
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
               <Mail className="w-4 h-4" /> {user?.email}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
               <Shield className="w-4 h-4 text-primary" /> Administrator Role
            </div>
          </div>
          <div className="pt-4 flex justify-center md:justify-start gap-2">
            <span className="px-4 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">Verified Identity</span>
            <span className="px-4 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">Member Since {getJoinYear()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Forms Section */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                    <Shield className="w-6 h-6 text-primary" /> Core Administrative Data
                 </h3>
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{getLastUpdateText()}</span>
              </div>
              
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Identity Name</label>
                    <div className="relative">
                       <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          required
                          value={adminData?.name || ""}
                          onChange={(e) => setAdminData({...adminData, name: e.target.value})}
                          placeholder="e.g. John Doe"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                    <div className="relative">
                       <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          value={adminData?.phone || ""}
                          onChange={(e) => setAdminData({...adminData, phone: e.target.value})}
                          placeholder="+94 7X XXX XXXX"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                 </div>

                 <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Assigned Address</label>
                    <div className="relative">
                       <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          value={adminData?.address || ""}
                          onChange={(e) => setAdminData({...adminData, address: e.target.value})}
                          placeholder="Current Residential Address"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                 </div>

                 <div className="md:col-span-2 pt-4">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="w-full md:w-auto px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
                    >
                       {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Save Authority Profile</>}
                    </button>
                 </div>
              </form>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                   <Key className="w-6 h-6 text-amber-500" /> Credential Management
                 </h3>
              </div>
              
              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col md:flex-row items-center gap-6">
                 <div className="space-y-1 flex-1">
                    <p className="text-sm font-black text-amber-800 uppercase tracking-tight">Email Recovery Key</p>
                    <p className="text-xs text-amber-600 font-medium leading-relaxed">
                       Your primary authenticated email is <strong>{user?.email}</strong>. 
                       To update credentials or MFA protocols, please contact system security.
                    </p>
                 </div>
                 <button 
                    onClick={() => toast.error("Self-service auth update restricted.")}
                    className="px-6 py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all whitespace-nowrap"
                 >
                    Modify Access
                 </button>
              </div>
           </div>
        </div>

        {/* Sidebar Info Section */}
        <div className="space-y-8">
           <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col justify-center shadow-2xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 rounded-full blur-[80px] -mr-24 -mt-24"></div>
              <div className="relative z-10 space-y-6">
                 <h4 className="text-lg font-black tracking-tight mb-2 uppercase flex items-center gap-2 text-primary"><Zap className="w-5 h-5 fill-primary" /> Operational Matrix</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                       <span className="text-xs text-white/50 font-bold uppercase tracking-widest">Global Status</span>
                       <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> Active Admin
                       </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                       <span className="text-xs text-white/50 font-bold uppercase tracking-widest">Auth Schema</span>
                       <span className="text-xs font-black uppercase tracking-widest text-slate-300">Firebase v9</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-white/50 font-bold uppercase tracking-widest">Session Start</span>
                       <span className="text-xs font-black uppercase tracking-widest text-slate-300">{format(new Date(), "hh:mm a")}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm space-y-6 text-slate-800">
              <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                 <Activity className="w-5 h-5 text-primary" /> Session Activity Log
              </h4>
              <div className="space-y-6">
                 {[
                   { action: "Admin Portal Accessed", time: "Just now", icon: User },
                   { action: "Profile Integrity Validated", time: "2m ago", icon: Shield },
                   { action: "Financial Module Sync", time: "1h ago", icon: Calendar }
                 ].map((log, i) => (
                   <div key={i} className="flex gap-4 items-start border-l-2 border-slate-50 pl-4 py-1 relative">
                      <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-200"></div>
                      <div className="flex-1">
                         <p className="text-xs font-bold text-slate-700">{log.action}</p>
                         <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{log.time}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
