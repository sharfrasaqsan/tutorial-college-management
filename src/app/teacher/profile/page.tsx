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
  Smartphone,
  MapPin,
  Calendar,
  Zap,
  Activity,
  GraduationCap,
  BookOpen,
  Backpack
} from "lucide-react";
import toast from "react-hot-toast";

export default function TeacherProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherData, setTeacherData] = useState<any>(null);

  useEffect(() => {
    async function fetchTeacherData() {
      if (!user) return;
      try {
        const docRef = doc(db, "teachers", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTeacherData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching teacher data:", error);
        toast.error("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    }
    fetchTeacherData();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const docRef = doc(db, "teachers", user.uid);
      await updateDoc(docRef, {
        phone: teacherData.phone || "",
        address: teacherData.address || "",
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

  const getJoinDate = () => {
    if (!teacherData?.createdAt) return "Select Period";
    const date = teacherData.createdAt.toDate ? teacherData.createdAt.toDate() : new Date(teacherData.createdAt);
    return format(date, "MMMM yyyy");
  };

  const getLastUpdateText = () => {
    if (!teacherData?.updatedAt) return "Original Registry";
    const date = teacherData.updatedAt.toDate ? teacherData.updatedAt.toDate() : new Date(teacherData.updatedAt);
    return `Last Sync: ${format(date, "MMM dd")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Profile Card */}
      <div className="relative bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden p-8 flex flex-col md:flex-row items-center gap-8 text-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl -ml-24 -mb-24"></div>

        <div className="relative group">
          <div className="w-32 h-32 rounded-[40px] bg-slate-100 flex items-center justify-center border-4 border-white shadow-xl relative overflow-hidden">
            {teacherData?.photoURL ? (
              <img src={teacherData.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-slate-300" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-2xl border-4 border-white flex items-center justify-center shadow-lg text-white">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className="text-center md:text-left space-y-2 flex-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <h2 className="text-3xl font-black tracking-tight">{teacherData?.name || "Faculty Member"}</h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest border border-indigo-100 self-center">
              UID: {user?.uid.substring(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
               <Mail className="w-4 h-4" /> {user?.email}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
               <BookOpen className="w-4 h-4 text-indigo-500" /> Specialist Faculty
            </div>
          </div>
          <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-2">
            <span className="px-4 py-1.5 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-slate-200">
              <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" /> Professional Grade 
            </span>
            <span className="px-4 py-1.5 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100">Instructor Since {getJoinDate()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-slate-800">
        {/* Forms Section */}
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xl font-bold flex items-center gap-3">
                    <User className="w-6 h-6 text-indigo-600" /> Instructor Credentials
                 </h3>
                 <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{getLastUpdateText()}</span>
              </div>
              
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Official Full Name</label>
                    <div className="relative">
                       <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          readOnly
                          value={teacherData?.name || ""}
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-400 cursor-not-allowed"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Handset</label>
                    <div className="relative">
                       <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          value={teacherData?.phone || ""}
                          onChange={(e) => setTeacherData({...teacherData, phone: e.target.value})}
                          placeholder="+94 7X XXX XXXX"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                 </div>

                 <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Residential Location</label>
                    <div className="relative">
                       <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                       <input 
                          type="text" 
                          value={teacherData?.address || ""}
                          onChange={(e) => setTeacherData({...teacherData, address: e.target.value})}
                          placeholder="Residential Address"
                          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all font-bold text-slate-700"
                       />
                    </div>
                 </div>

                 <div className="md:col-span-2 pt-4">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="w-full md:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 disabled:opacity-50"
                    >
                       {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Finalize My Profile</>}
                    </button>
                 </div>
              </form>
           </div>

           <div className="bg-slate-50 rounded-[32px] border border-slate-100 p-8">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                 <Backpack className="w-6 h-6 text-purple-500" /> Assigned Subjects
              </h3>
              <div className="flex flex-wrap gap-3">
                 {teacherData?.subjects?.length > 0 ? teacherData.subjects.map((sub: string, i: number) => (
                    <div key={i} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
                       <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                       <span className="text-sm font-black text-slate-700 uppercase tracking-tight">{sub}</span>
                    </div>
                 )) : (
                    <p className="text-sm text-slate-400 font-medium italic">No specific subjects assigned yet.</p>
                 )}
              </div>
           </div>
        </div>

        {/* Sidebar Info Section */}
        <div className="space-y-8">
           <div className="bg-indigo-600 rounded-[32px] p-8 text-white relative overflow-hidden flex flex-col justify-center shadow-2xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-[80px] -mr-24 -mt-24"></div>
              <div className="relative z-10 space-y-6">
                 <h4 className="text-lg font-black tracking-tight mb-2 uppercase flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-300" /> Academic Matrix</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/20 pb-4">
                       <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Portal Access</span>
                       <span className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse border-2 border-white"></div> Active Faculty
                       </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/20 pb-4">
                       <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Internal Grade</span>
                       <span className="text-xs font-black uppercase tracking-widest text-white">Tier A+ Specialist</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Current Session</span>
                       <span className="text-xs font-black uppercase tracking-widest text-white">{format(new Date(), "hh:mm a")}</span>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm space-y-8 text-slate-800">
              <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                 <Activity className="w-5 h-5 text-indigo-500" /> Productivity Log
              </h4>
              <div className="space-y-8">
                 {[
                   { action: "Faculty Dashboard Accessed", time: "Just now", icon: Zap, color: "text-amber-500" },
                   { action: "Profile Sync Validated", time: "5m ago", icon: CheckCircle, color: "text-emerald-500" },
                   { action: "Academic Schedule Update", time: "Last Sync", icon: Calendar, color: "text-indigo-500" }
                 ].map((log, i) => (
                   <div key={i} className="flex gap-4 items-start relative">
                      <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 ${log.color}`}>
                         <log.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                         <p className="text-xs font-black text-slate-700 tracking-tight leading-tight">{log.action}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{log.time}</p>
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
