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
  ChevronRight,
  ChevronLeft,
  Target,
  Layers,
  CheckCircle2,
  Calendar,
  X,
  Hash,
  Activity,
  ArrowRight
} from "lucide-react";
import { Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { formatTime } from "@/lib/formatters";

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
        teacherName: selectedClass?.teacherName || "",
        gradeId: selectedClass?.gradeId || "",
        grade: selectedClass?.grade || "",
        subjectId: selectedClass?.subjectId || "",
        subject: selectedClass?.subject || "",
        date: sessionDate,
        dayOfWeek: targetDayOfWeek,
        startTime,
        endTime,
        room: room.trim(),
        status: "scheduled",
        createdAt: serverTimestamp(),
      });

      toast.success("Extra session scheduled!", { 
        icon: "📅",
        style: { borderRadius: '1rem', background: '#334155', color: '#fff', fontSize: '12px', fontWeight: 'bold' } 
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error scheduling extra session:", error);
      toast.error("Failed to schedule session.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>

      <div className={`relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all duration-300 ease-out flex flex-col h-[85vh] ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
        
        {/* 🏛️ Header Segment (StudentModal Parity) */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <CalendarPlus className="w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-3 leading-none uppercase tracking-tight">
                        Extra Mission Deployment
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Hash className="w-3.5 h-3.5" /> {selectedClassId ? selectedClassId.substring(0, 8).toUpperCase() : "PENDING TARGET"}
                         </span>
                         <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                         <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            FACULTY DIRECTIVE
                         </span>
                    </div>
                </div>
            </div>
            <button 
                onClick={onClose}
                className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all group"
            >
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* 📑 Tabbed Navigation (StudentModal Parity) */}
        <div className="px-8 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 shrink-0">
            {(['overview', 'schedule', 'verify'] as const).map((tab, idx) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => {
                        if (tab === 'schedule' && !selectedClassId) { toast.error("Select Target Unit First"); return; }
                        if (tab === 'verify' && (!sessionDate || !startTime || !endTime || !room)) { toast.error("Configure Schedule First"); return; }
                        setActiveTab(tab);
                    }}
                    className={`px-5 py-4 text-sm font-bold transition-all relative capitalize flex items-center gap-3 ${activeTab === tab ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>0{idx + 1}</span>
                    {tab}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full transition-all" />
                    )}
                </button>
            ))}
        </div>

        {/* 🎞️ Content Reservoir (StudentModal Parity) */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-white">
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
            
            {activeTab === 'overview' && (
              <div className="space-y-10">
                <div className="space-y-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Target className="w-3.5 h-3.5" /> Mission Targeting
                    </h4>
                    
                    <div className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] flex items-start gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-1.5">Primary Academic Unit</h4>
                            <p className="text-[11px] text-indigo-600/80 font-bold leading-relaxed">Select the parent class for this extra mission. Academic metrics and financial settings will be synchronized from the parent ledger.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {classes.filter(c => c.status === 'active').map(cls => (
                            <button
                                key={cls.id}
                                onClick={() => {
                                    setSelectedClassId(cls.id);
                                    setActiveTab('schedule');
                                }}
                                className={`p-5 rounded-3xl border transition-all duration-300 flex items-center justify-between group/cls ${selectedClassId === cls.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                <div className="flex flex-col gap-1.5 text-left">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${selectedClassId === cls.id ? 'text-indigo-100' : 'text-indigo-600'}`}>{cls.subject}</span>
                                    <h5 className="text-base font-black tracking-tight leading-none">{cls.name}</h5>
                                    <div className={`flex items-center gap-2 mt-1 ${selectedClassId === cls.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        <div className="w-1 h-1 rounded-full bg-current"></div>
                                        <span className="text-[10px] font-bold">Cycle {cls.sessionsSinceLastPayment || 0}/{cls.sessionsPerCycle || 8}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-[11px] font-black uppercase tracking-widest ${selectedClassId === cls.id ? 'text-white' : 'text-slate-800'}`}>{cls.grade}</div>
                                    <div className={`mt-2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedClassId === cls.id ? 'bg-white text-indigo-600 rotate-90' : 'bg-slate-50 text-slate-300'}`}>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-10">
                <div className="space-y-8">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Clock className="w-3.5 h-3.5" /> Temporal Configuration
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Deployment Date */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Deployment Date</label>
                            <div className="relative group">
                                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 transition-transform group-focus-within:scale-110" />
                                <input
                                    type="date"
                                    value={sessionDate}
                                    onChange={(e) => setSessionDate(e.target.value)}
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-sm text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Facility / Room */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Designated Facility (Room)</label>
                            <div className="relative group">
                                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400" />
                                <input
                                    type="text"
                                    value={room}
                                    onChange={(e) => setRoom(e.target.value)}
                                    placeholder="Specify Hall or Room Code..."
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-sm text-slate-800 placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Start Time */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Activation Time</label>
                            <div className="relative group">
                                <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-sm text-slate-800"
                                />
                            </div>
                        </div>

                        {/* End Time */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Deactivation Time</label>
                            <div className="relative group">
                                <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 opacity-60" />
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-black text-sm text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-amber-50 rounded-[2.5rem] border border-amber-100 flex items-start gap-4">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">
                            Real-time conflict detection is active. The system will cross-reference 
                            all regular and extra schedules to prevent room, teacher, or grade overlaps.
                        </p>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'verify' && (
              <div className="space-y-10">
                <div className="space-y-8">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-4">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Final Verification
                    </h4>

                    <div className="bg-indigo-600 text-white rounded-[3rem] p-10 shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl transition-all group-hover:scale-110"></div>
                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-200 mb-3">Mission Unit</p>
                                    <h3 className="text-3xl font-black tracking-tighter capitalize">{selectedClass?.name}</h3>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">{selectedClass?.grade}</span>
                                        <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">{selectedClass?.subject}</span>
                                    </div>
                                </div>
                                <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                                   <Activity className="w-10 h-10 text-white" />
                                </div>
                            </div>
                            
                            <div className="h-px bg-white/20 w-full"></div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Date</p>
                                    <p className="text-sm font-black tabular-nums">{sessionDate}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Start Time</p>
                                    <p className="text-sm font-black tabular-nums">{formatTime(startTime)}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Facility</p>
                                    <p className="text-sm font-black">{room}</p>
                                </div>
                                <div className="space-y-2 text-right">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Auth Status</p>
                                    <p className="text-sm font-black text-emerald-400">READY</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-5 p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem]">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-800">Operational Confirmation</p>
                            <p className="text-[11px] font-bold text-slate-500 mt-1 leading-relaxed">
                                Deploying this mission will broadcast notifications to all enrolled students and 
                                permanently register the session in the institutional chronicle.
                            </p>
                        </div>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 🎮 Controls (StudentModal Parity) */}
        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-all"
            >
                Termination Signal
            </button>

            <div className="flex items-center gap-3">
                {activeTab !== 'overview' && (
                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab === 'schedule') setActiveTab('overview');
                            if (activeTab === 'verify') setActiveTab('schedule');
                        }}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <ChevronLeft className="w-4 h-4" /> Previous Stage
                    </button>
                )}

                {activeTab !== 'verify' ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab === 'overview') {
                                if (!selectedClassId) { toast.error("Select Target Unit"); return; }
                                setActiveTab('schedule');
                            } else {
                                if (!sessionDate || !startTime || !endTime || !room) { toast.error("Configure Schedule First"); return; }
                                if (startTime >= endTime) { toast.error("Slot Order Invalid"); return; }
                                setActiveTab('verify');
                            }
                        }}
                        className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-slate-200 active:scale-95"
                    >
                        Advance Pipeline <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={handleFinalSubmit}
                        disabled={loading}
                        className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                        {loading ? "Validating Matrix..." : "Confirm Deployment"}
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
