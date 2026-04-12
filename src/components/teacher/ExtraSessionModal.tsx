"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarPlus, Clock, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Class } from "@/types/models";
import { useAuth } from "@/context/AuthContext";
import Modal from "@/components/ui/Modal";
import toast from "react-hot-toast";
import { format } from "date-fns";

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

export default function ExtraSessionModal({ isOpen, onClose, onSuccess, classes, preselectedDate }: ExtraSessionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sessionDate, setSessionDate] = useState(preselectedDate ? format(preselectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [room, setRoom] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
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

  const handleSubmit = async () => {
    if (!user?.uid) return;

    // Basic validation
    if (!selectedClassId) { toast.error("Please select a class."); return; }
    if (!sessionDate) { toast.error("Please select a date."); return; }
    if (!startTime) { toast.error("Please set a start time."); return; }
    if (!endTime) { toast.error("Please set an end time."); return; }
    if (!room.trim()) { toast.error("Please specify a room/hall."); return; }
    if (startTime >= endTime) { toast.error("End time must be after start time."); return; }

    setLoading(true);
    try {
      const targetDate = new Date(sessionDate);
      const targetDayOfWeek = format(targetDate, "eeee").toLowerCase();

      // --- CONFLICT CHECKS ---
      // 1. Fetch ALL active classes (for cross-teacher/grade/room checks)
      const allClassesSnap = await getDocs(collection(db, "classes"));
      const allClasses = allClassesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class)).filter(c => c.status === 'active');

      // 2. Fetch ALL extra sessions on the same date
      const existingExtrasQ = query(
        collection(db, "extra_sessions"),
        where("date", "==", sessionDate),
        where("status", "==", "scheduled")
      );
      const existingExtrasSnap = await getDocs(existingExtrasQ);
      const existingExtras = existingExtrasSnap.docs.map(d => ({ id: d.id, ...d.data() } as ExtraSession));

      // --- Check REGULAR class schedules on the same day-of-week ---
      for (const cls of allClasses) {
        for (const schedule of (cls.schedules || [])) {
          if (schedule.dayOfWeek.toLowerCase() !== targetDayOfWeek) continue;
          if (!hasOverlap(startTime, endTime, schedule.startTime, schedule.endTime)) continue;

          // Room conflict with regular schedule
          if (room.trim().toLowerCase() === schedule.room.trim().toLowerCase()) {
            toast.error(`Room Conflict: ${room} is occupied by "${cls.name}" at ${schedule.startTime}-${schedule.endTime} on ${targetDayOfWeek}s.`);
            setLoading(false);
            return;
          }

          // Teacher conflict with regular schedule
          if (cls.teacherId === user.uid) {
            toast.error(`Teacher Conflict: You already have "${cls.name}" scheduled at ${schedule.startTime}-${schedule.endTime} on ${targetDayOfWeek}s.`);
            setLoading(false);
            return;
          }

          // Grade conflict with regular schedule
          if (selectedClass && cls.gradeId === selectedClass.gradeId) {
            toast.error(`Grade Conflict: ${selectedClass.grade} already has "${cls.name}" at ${schedule.startTime}-${schedule.endTime} on ${targetDayOfWeek}s.`);
            setLoading(false);
            return;
          }
        }
      }

      // --- Check EXTRA sessions on the same date ---
      for (const extra of existingExtras) {
        if (!hasOverlap(startTime, endTime, extra.startTime, extra.endTime)) continue;

        // Room conflict with extra session
        if (room.trim().toLowerCase() === extra.room.trim().toLowerCase()) {
          toast.error(`Room Conflict: ${room} is already booked for an extra session "${extra.className}" at ${extra.startTime}-${extra.endTime}.`);
          setLoading(false);
          return;
        }

        // Teacher conflict with extra session
        if (extra.teacherId === user.uid) {
          toast.error(`Teacher Conflict: You already have an extra session "${extra.className}" at ${extra.startTime}-${extra.endTime} on this date.`);
          setLoading(false);
          return;
        }

        // Grade conflict with extra session
        if (selectedClass && extra.gradeId === selectedClass.gradeId) {
          toast.error(`Grade Conflict: ${selectedClass.grade} already has an extra session "${extra.className}" at ${extra.startTime}-${extra.endTime}.`);
          setLoading(false);
          return;
        }

        // Duplicate: same class, same date, same time
        if (extra.classId === selectedClassId && extra.startTime === startTime) {
          toast.error(`Duplicate: An extra session for "${extra.className}" already exists at ${extra.startTime} on this date.`);
          setLoading(false);
          return;
        }
      }

      // --- All checks passed: Save the extra session ---
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

      toast.success("Extra session scheduled successfully!", { icon: "📅" });
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error scheduling extra session:", error);
      toast.error("Failed to schedule extra session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Extra Session">
      <div className="space-y-6">
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <CalendarPlus className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-1">One-Time Session</p>
            <p className="text-[11px] text-indigo-600 font-medium leading-relaxed">
              This session will appear only on the selected date and counts toward the payment cycle progression of the selected class.
            </p>
          </div>
        </div>

        {/* Class Selection */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center gap-2">
            Parent Class *
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">(Inherits payroll settings)</span>
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
          >
            <option value="">Select a Class...</option>
            {classes.filter(c => c.status === 'active').map(cls => (
              <option key={cls.id} value={cls.id}>
                {cls.name} • {cls.grade}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Class Info */}
        {selectedClass && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Subject', value: selectedClass.subject },
              { label: 'Grade', value: selectedClass.grade },
              { label: 'Cycle', value: `${selectedClass.sessionsSinceLastPayment || 0}/${selectedClass.sessionsPerCycle || 8}` },
            ].map((stat, i) => (
              <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest mb-1">{stat.label}</p>
                <p className="text-xs font-black text-slate-700">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Date */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700 ml-1">Session Date *</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
          />
        </div>

        {/* Time & Room */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-indigo-400" /> Start Time *
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-indigo-400" /> End Time *
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-emerald-400" /> Room / Hall *
            </label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="e.g. Room 201"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-sm"
            />
          </div>
        </div>

        {/* Conflict Warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
            The system will automatically check for room, teacher, and grade conflicts against both regular weekly schedules and other extra sessions before confirming.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
            {loading ? "Validating..." : "Schedule Session"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
