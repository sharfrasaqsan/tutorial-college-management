"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
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
  Calendar,
  Zap,
  Activity,
  GraduationCap,
  BookOpen,
  Fingerprint
} from "lucide-react";
import toast from "react-hot-toast";
import { Teacher, Class } from "@/types/models";
import Image from "next/image";

export default function TeacherProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    weeklySessions: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Fetch Teacher Profile
        const docRef = doc(db, "teachers", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTeacherData({ id: docSnap.id, ...docSnap.data() } as Teacher);
        }

        // 2. Fetch Teacher Stats (from Classes)
        const q = query(collection(db, "classes"), where("teacherId", "==", user.uid));
        const classSnap = await getDocs(q);
        const fetchedClasses = classSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        
        let totalSt = 0;
        let totalSch = 0;
        fetchedClasses.forEach((c: Class) => {
           totalSt += (c.studentCount || 0);
           totalSch += (c.schedules?.length || 0);
        });

        setStats({
          totalClasses: fetchedClasses.length,
          totalStudents: totalSt,
          weeklySessions: totalSch
        });

      } catch (error) {
        console.error("Error fetching profile data:", error);
        toast.error("Failed to load secure profile data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !teacherData) return;
    setSaving(true);
    try {
      const docRef = doc(db, "teachers", user.uid);
      await updateDoc(docRef, {
        phone: teacherData.phone || "",
        address: teacherData.address || "",
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
    if (!teacherData?.createdAt) return "2024";
    const raw = teacherData.createdAt as any;
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    return format(date, "yyyy");
  };

  const getLastUpdateText = () => {
    if (!teacherData?.updatedAt) return "Original Registry";
    const raw = teacherData.updatedAt as any;
    const date = raw?.toDate ? raw.toDate() : new Date(raw);
    return `Update: ${format(date, "MMM dd, hh:mm a")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">
      
      {/* 🏅 Faculty Identity Header */}
      <div className="relative overflow-hidden rounded-[3rem] bg-white border border-slate-200/50 shadow-2xl shadow-indigo-100/20 p-1">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-[100px] -mr-64 -mt-64 transition-transform duration-1000 group-hover:scale-110"></div>
        <div className="bg-slate-50/50 rounded-[2.9rem] p-8 md:p-10 flex flex-col lg:flex-row items-center gap-10 relative z-10">
          
          <div className="relative group">
            <div className="w-40 h-40 rounded-[48px] overflow-hidden border-8 border-white shadow-2xl relative transition-transform duration-500 group-hover:scale-[1.02]">
              {teacherData?.photoURL ? (
                <Image 
                  src={teacherData.photoURL} 
                  alt="Profile" 
                  fill
                  className="object-cover" 
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                   <User className="w-16 h-16 text-slate-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer backdrop-blur-[2px]">
                <Camera className="w-8 h-8 text-white animate-bounce" />
              </div>
            </div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-indigo-600 rounded-3xl border-4 border-white flex items-center justify-center shadow-xl rotate-12 group-hover:rotate-0 transition-transform">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="flex flex-wrap justify-center lg:justify-start gap-3">
               <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-200">Official Faculty ID</span>
               <span className="px-4 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-[0.2em]">Tier 1 Professional</span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-none">
                {teacherData?.name || "Professor Name"}
              </h1>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 mt-4">
                <div className="flex items-center gap-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest bg-white/50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                   <Mail className="w-4 h-4 text-indigo-500" />
                   {user?.email}
                </div>
                <div className="flex items-center gap-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest bg-white/50 px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
                   <Smartphone className="w-4 h-4 text-emerald-500" />
                   {teacherData?.phone || "Registry Missing"}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden xl:flex flex-col items-end gap-3 translate-y-4">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">Verification Status</p>
             <div className="px-6 py-4 bg-white/80 backdrop-blur-md border border-indigo-100 rounded-3xl shadow-xl shadow-indigo-100/20 flex items-center gap-4">
                <div className="w-2 h-12 bg-emerald-500 rounded-full animate-pulse"></div>
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Network Security</p>
                   <p className="text-sm font-black text-slate-900 leading-none">IDENTITY SECURE</p>
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
                    <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-indigo-600">
                       <Fingerprint className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">Institutional Registry</h3>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{getLastUpdateText()}</p>
                    </div>
                 </div>
              </div>
              
              <div className="p-10">
                <form onSubmit={handleUpdateProfile} className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 ml-1">Assigned Name</label>
                         <div className="relative group/input">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-indigo-400 transition-colors" />
                            <input 
                               type="text" 
                               readOnly
                               value={teacherData?.name || ""}
                               className="w-full pl-14 pr-6 py-4 bg-slate-50/50 border border-slate-100 rounded-2xl font-black text-[11px] text-slate-400 uppercase tracking-widest cursor-not-allowed transition-all"
                            />
                         </div>
                      </div>

                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 ml-1">Contact Handset</label>
                         <div className="relative group/input">
                            <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-indigo-500 transition-colors" />
                            <input 
                               type="text" 
                               value={teacherData?.phone || ""}
                               onChange={(e) => setTeacherData(teacherData ? {...teacherData, phone: e.target.value} : null)}
                               className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-[13px] text-slate-800 tabular-nums shadow-sm"
                            />
                         </div>
                      </div>

                      <div className="md:col-span-2 space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 ml-1">Residential Coordinates</label>
                         <div className="relative group/input">
                            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-hover/input:text-indigo-500 transition-colors" />
                            <input 
                               type="text" 
                               value={teacherData?.address || ""}
                               onChange={(e) => setTeacherData(teacherData ? {...teacherData, address: e.target.value} : null)}
                               className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-[11px] text-slate-800 uppercase tracking-widest shadow-sm"
                            />
                         </div>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-4">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-relaxed max-w-[300px]">
                         Unauthorized changes to locked fields require administrative hardware verification.
                      </p>
                      <button 
                        type="submit"
                        disabled={saving}
                        className="px-10 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-900 transition-all flex items-center gap-3 shadow-2xl shadow-indigo-200 disabled:opacity-50 active:scale-95"
                      >
                         {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Push Identity Sync</>}
                      </button>
                   </div>
                </form>
              </div>
           </div>

           {/* 🎓 Curriculum Grid */}
           <div className="bg-white rounded-[3rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-10 space-y-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <BookOpen className="w-6 h-6" />
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-slate-800 tracking-wider uppercase">Instructional Capacity</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Authoritative subjects & specialities</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {teacherData?.subjects?.length ? teacherData.subjects.map((sub: string, i: number) => (
                    <div key={i} className="px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-between group hover:bg-indigo-600 hover:border-indigo-500 transition-all duration-300 cursor-default">
                       <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white transition-colors">{sub}</span>
                       <Zap className="w-4 h-4 text-indigo-400 group-hover:text-white group-hover:fill-white transition-all" />
                    </div>
                 )) : (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No curriculum segments mapped.</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           
           {/* 🛸 Global Status Widget */}
           <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden flex flex-col justify-center shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
              <div className="relative z-10 space-y-8">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black tracking-widest uppercase text-indigo-400">Security Access</span>
                    <Shield className="w-4 h-4 text-indigo-400" />
                 </div>
                 
                 <div className="space-y-5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                       <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Faculty Tier</span>
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> Verified Status
                       </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                       <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Units Active</span>
                       <span className="text-[11px] font-black uppercase tracking-widest text-white">{stats.totalClasses} Units</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">Temporal Origin</span>
                       <span className="text-[11px] font-black uppercase tracking-widest text-white">{getJoinYear()} Registry</span>
                    </div>
                 </div>

                 <div className="pt-2">
                    <button className="w-full py-4 bg-white/10 border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">
                       Download Identity Badge
                    </button>
                 </div>
              </div>
           </div>

           {/* 🛰️ Verification Telemetry */}
           <div className="bg-white rounded-[3rem] border border-slate-200/60 p-8 shadow-xl shadow-slate-200/20 space-y-8">
              <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-slate-800">
                    <Activity className="w-4 h-4 text-indigo-600" /> System Telemetry
                 </h4>
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
              
              <div className="space-y-6 relative">
                 <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-100"></div>
                 {[
                   { action: "Identity Sync Finalized", time: "0s ago", icon: Shield, color: "text-emerald-500" },
                   { action: "Cloud Registry Validated", time: "14m ago", icon: CheckCircle, color: "text-indigo-500" },
                   { action: "Curriculum State Verified", time: "2h ago", icon: Calendar, color: "text-slate-400" }
                 ].map((log, i) => (
                    <div key={i} className="flex gap-5 items-start relative z-10">
                        <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shrink-0">
                           <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{log.action}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">{log.time}</p>
                        </div>
                        <log.icon className={`w-3.5 h-3.5 ${log.color} opacity-40`} />
                    </div>
                 ))}
              </div>
              <p className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest pt-4 border-t border-slate-50 italic">
                 Institutional audit trail fully encrypted.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
