"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CalendarPlus, 
  Clock, 
  MapPin, 
  Loader2, 
  AlertTriangle,
  Target,
  Layers,
  CheckCircle2,
  Calendar,
  X,
  Activity,
  ArrowRight
} from "lucide-react";
import { Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { formatTime } from "@/lib/formatters";
import { notifyAdmins } from "@/hooks/useNotifications";

interface ExtraSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classes: Class[];
  preselectedDate?: Date;
}

interface ExtraSession {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  gradeId: string;
  grade: string;
  subjectId: string;
  subject: string;
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
  createdAt: any;
}

type Tab = "overview" | "schedule" | "verify";

export default function ExtraSessionModal({ isOpen, onClose, onSuccess, classes, preselectedDate }: ExtraSessionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Form state
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sessionDate, setSessionDate] = useState(preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [room, setRoom] = useState("");

  useEffect(() => {
    if (isOpen) {
      setActiveTab("overview");
      setSelectedClassId("");
      setSessionDate(preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
      setStartTime("");
      setEndTime("");
      setRoom("");
    }
  }, [isOpen, preselectedDate]);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const hasOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    return s1 < e2 && s2 < e1;
  };

  const handleFinalSubmit = async () => {
    if (!user?.uid || !selectedClass) return;
    setLoading(true);
    try {
      const targetDate = new Date(sessionDate);
      const targetDayOfWeek = format(targetDate, "eeee").toLowerCase();

      const allClassesSnap = await getDocs(collection(db, "classes"));
      const allClasses = allClassesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)).filter(c => c.status === 'active');

      const existingExtrasQ = query(
        collection(db, "extra_sessions"),
        where("date", "==", sessionDate),
        where("status", "==", "scheduled")
      );
      const existingExtrasSnap = await getDocs(existingExtrasQ);
      const existingExtras = existingExtrasSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExtraSession));

      for (const cls of allClasses) {
        for (const schedule of (cls.schedules || [])) {
          if (schedule.dayOfWeek.toLowerCase() !== targetDayOfWeek) continue;
          if (!hasOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) continue;

          if (room.trim().toLowerCase() === schedule.room.trim().toLowerCase()) {
            toast.error(`Room Conflict: ${room} is occupied by "${cls.name}" at ${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)} on ${targetDayOfWeek}s.`);
            setLoading(false);
            return;
          }
          if (cls.teacherId === user.uid) {
            toast.error(`Teacher Conflict: You already have "${cls.name}" scheduled at ${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)} on ${targetDayOfWeek}s.`);
            setLoading(false);
            return;
          }
          if (cls.gradeId === selectedClass.gradeId) {
            toast.error(`Grade Conflict: ${selectedClass.grade} already has "${cls.name}" at ${formatTime(schedule.startTime)}-${formatTime(schedule.endTime)} on ${targetDayOfWeek}s.`);
            setLoading(false);
            return;
          }
        }
      }

      for (const extra of existingExtras) {
        if (!hasOverlap(startTime, endTime, extra.startTime, extra.endTime)) continue;
        if (room.trim().toLowerCase() === extra.room.trim().toLowerCase()) {
          toast.error(`Room Conflict: ${room} is already booked for "${extra.className}" at ${formatTime(extra.startTime)}-${formatTime(extra.endTime)}.`);
          setLoading(false);
          return;
        }
        if (extra.teacherId === user.uid) {
          toast.error(`Teacher Conflict: You already have an extra session "${extra.className}" at ${formatTime(extra.startTime)}-${formatTime(extra.endTime)} on this date.`);
          setLoading(false);
          return;
        }
        if (extra.gradeId === selectedClass.gradeId) {
          toast.error(`Grade Conflict: ${selectedClass.grade} already has an extra session "${extra.className}" at ${formatTime(extra.startTime)}-${formatTime(extra.endTime)}.`);
          setLoading(false);
          return;
        }
      }

      const extraId = `extra_${selectedClassId}_${sessionDate}_${startTime.replace(/:/g, '-')}`;
      await setDoc(doc(db, "extra_sessions", extraId), {
        classId: selectedClassId,
        className: selectedClass?.name || "",
        teacherId: user.uid,
        teacherName: user.displayName || "Teacher",
        gradeId: selectedClass?.gradeId || "",
        grade: selectedClass?.grade || "",
        subjectId: selectedClass?.subjectId || "",
        subject: selectedClass?.subject || "",
        date: sessionDate,
        dayOfWeek: targetDayOfWeek,
        startTime,
        endTime,
        room,
        status: "scheduled",
        createdAt: serverTimestamp()
      });

      // Notify Admin
      await notifyAdmins({
        title: "Extra Session Logged",
        message: `${user.displayName || 'A teacher'} has scheduled an extra session for ${selectedClass?.name} on ${sessionDate}.`,
        type: "info",
        link: "/admin/timetable"
      });

      toast.success("Extra class added!");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("System error.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className={`fixed inset-0 bg-slate-900/40 transition-all duration-300 ${isOpen ? "backdrop-blur-sm" : ""}`} onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* 🏛️ Modal Header - Student Modal Parity */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xl shadow-inner group">
                    <CalendarPlus className="w-7 h-7 group-hover:scale-110 transition-transform" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none">
                        Add Extra Class
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" /> Extra class slot
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className={`text-[10px] font-bold uppercase tracking-wider text-indigo-600 animate-pulse`}>
                            Ready
                         </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* 📑 Institutional Tabs */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['Class', 'Time', 'Check'] as const).map((tab) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab === 'Class' ? 'overview' : tab === 'Time' ? 'schedule' : 'verify')}
                    className={`px-5 py-4 text-sm font-medium transition-all relative capitalize ${
                        (tab === 'Class' && activeTab === 'overview') || 
                        (tab === 'Time' && activeTab === 'schedule') || 
                        (tab === 'Check' && activeTab === 'verify') 
                        ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    {tab}
                    {((tab === 'Class' && activeTab === 'overview') || 
                      (tab === 'Time' && activeTab === 'schedule') || 
                      (tab === 'Check' && activeTab === 'verify')) && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full transition-all" />
                    )}
                </button>
            ))}
        </div>

        {/* 🖋️ Form Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
          <div className="animate-in fade-in duration-500 pb-10">
            
            {activeTab === 'overview' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <Layers className="w-3.5 h-3.5" /> Select Class
                  </h4>
                  
                  <div className="space-y-6">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Pick a Class</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {classes.map(cls => (
                            <button
                                key={cls.id}
                                type="button"
                                onClick={() => setSelectedClassId(cls.id)}
                                className={`p-5 rounded-2xl border text-left transition-all relative ${selectedClassId === cls.id ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                            >
                                <h5 className={`font-bold text-sm ${selectedClassId === cls.id ? 'text-white' : 'text-slate-800'}`}>{cls.name}</h5>
                                <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${selectedClassId === cls.id ? 'text-slate-400' : 'text-slate-400'}`}>{cls.subject} • {cls.grade}</p>
                                {selectedClassId === cls.id && <CheckCircle2 className="absolute top-4 right-4 w-5 h-5 text-emerald-400" />}
                            </button>
                        ))}
                        {classes.length === 0 && (
                            <div className="col-span-full py-10 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                                <p className="text-sm font-bold text-slate-400">No active classes found.</p>
                            </div>
                        )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-6">
                     <button
                        type="button"
                        disabled={!selectedClassId}
                        onClick={() => setActiveTab('schedule')}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-30 disabled:pointer-events-none"
                     >
                        Next: Time Details <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <Clock className="w-3.5 h-3.5" /> Date & Time
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Session Date</label>
                       <div className="relative">
                          <input 
                            type="date" 
                            value={sessionDate}
                            onChange={(e) => setSessionDate(e.target.value)}
                            className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 transition-all font-bold text-slate-700 outline-none" 
                          />
                          <Calendar className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Room</label>
                       <div className="relative">
                          <input 
                            type="text" 
                            placeholder="e.g. Hall A"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 transition-all font-bold text-slate-700 outline-none" 
                          />
                          <MapPin className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Indicated Start</label>
                       <div className="relative">
                          <input 
                            type="time" 
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 transition-all font-bold text-slate-700 outline-none" 
                          />
                          <Clock className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Indicated End</label>
                       <div className="relative">
                          <input 
                            type="time" 
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 transition-all font-bold text-slate-700 outline-none" 
                          />
                          <Clock className="absolute left-4.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-6">
                     <button
                        type="button"
                        disabled={!startTime || !endTime || !room || !sessionDate}
                        onClick={() => setActiveTab('verify')}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all shadow-lg disabled:opacity-30 disabled:pointer-events-none"
                     >
                        Next: Check Details <ArrowRight className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'verify' && (
              <div className="max-w-4xl mx-auto space-y-12">
                <div className="space-y-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                     <CheckCircle2 className="w-3.5 h-3.5" /> Review Details
                  </h4>

                  <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-100 space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1.5">Class Details</p>
                            <h4 className="text-lg font-black text-slate-800">{selectedClass?.name}</h4>
                            <p className="text-xs font-bold text-slate-500">Scheduled for {sessionDate ? format(new Date(sessionDate), "EEEE, d MMMM yyyy") : 'Not set'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100/50">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Time</p>
                            <p className="text-xs font-bold text-slate-700 tabular-nums">{startTime} - {endTime}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Room</p>
                            <p className="text-xs font-bold text-slate-700">{room}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Type</p>
                            <p className="text-xs font-bold text-slate-700 italic">Extra</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Grade</p>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-tight">{selectedClass?.grade}</p>
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100/50 flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                        <p className="text-[11px] font-bold text-amber-700/80 leading-relaxed">
                            We will check for conflicts before finishing. Make sure this room is free during this time.
                        </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>

        {/* 🏛️ Modal Footer - Student Modal Parity */}
        <div className="px-8 py-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/30 z-10 shrink-0">
          <div className="hidden sm:flex items-center gap-3">
             <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-lg shadow-indigo-100"></div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-all"
            >
              Discard
            </button>
            <button 
              onClick={handleFinalSubmit}
              disabled={loading}
              className={`flex-1 sm:flex-none px-10 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-0 disabled:pointer-events-none ${activeTab === 'verify' ? '' : 'hidden'}`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Class"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
