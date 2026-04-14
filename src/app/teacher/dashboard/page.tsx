"use client";

import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Layers,
  Calendar,
  CheckCircle2,
  Wallet,
  Activity,
  CheckCircle,
  GraduationCap,
  MapPin,
  RotateCcw,
  Clock,
  Lock,
  Plus,
  ArrowRight,
  Briefcase,
  Projector,
  AlertTriangle,
  History,
  TrendingUp,
  Zap,
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";
import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  setDoc,
  onSnapshot,
  getDoc,
  Timestamp,
  getDocs,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Class, Teacher, Salary } from "@/types/models";
import { format, isAfter } from "date-fns";
import Link from "next/link";
import toast from "react-hot-toast";
import { processTeacherPayroll } from "@/lib/payroll";
import { formatTime } from "@/lib/formatters";
import ExtraSessionModal from "@/components/teacher/ExtraSessionModal";

interface SessionCompletion {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  date: string;
  dayOfWeek: string;
  timestamp: Timestamp;
  startTime: string;
  room: string;
  subject: string;
  grade: string;
  studentCount?: number;
  isPaid?: boolean;
}

interface ExtraSession {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  teacherName: string;
  grade: string;
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
}

interface TodayClass extends Partial<Class> {
  id: string;
  name: string;
  grade: string;
  subject: string;
  currentSlot: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    room: string;
  };
  isCompleted: boolean;
  isPaid?: boolean;
  isExtra?: boolean;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [allClasses, setAllClasses] = useState<Class[]>([]);
  const [todayCompletions, setTodayCompletions] = useState<SessionCompletion[]>(
    [],
  );
  const [recentCompletions, setRecentCompletions] = useState<
    SessionCompletion[]
  >([]);
  const [latestSalary, setLatestSalary] = useState<Salary | null>(null);
  const [teacherData, setTeacherData] = useState<Teacher | null>(null);
  const [extraSessionsToday, setExtraSessionsToday] = useState<ExtraSession[]>(
    [],
  );
  const [salariesCount, setSalariesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isExtraModalOpen, setIsExtraModalOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const todayStr = format(new Date(), "yyyy-MM-dd");

    const tRef = doc(db, "teachers", user.uid);
    const qClasses = query(
      collection(db, "classes"),
      where("teacherId", "==", user.uid),
    );

    const qTodayComp = query(
      collection(db, "session_completions"),
      where("teacherId", "==", user.uid),
      where("date", "==", todayStr),
    );

    const qRecentComp = query(
      collection(db, "session_completions"),
      where("teacherId", "==", user.uid),
      orderBy("timestamp", "desc"),
      limit(10),
    );

    const salaryRef = collection(db, "salaries");
    const salaryQuery = query(
      salaryRef,
      where("teacherId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(1),
    );

    const unsubscribeTeacher = onSnapshot(tRef, (snap) => {
      if (snap.exists())
        setTeacherData({ id: snap.id, ...snap.data() } as Teacher);
    });

    const unsubscribeClasses = onSnapshot(qClasses, (snap) => {
      const classesList = snap.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as Class,
      );
      setAllClasses(classesList);
      setLoading(false);
    });

    const unsubscribeTodayComp = onSnapshot(qTodayComp, (snap) => {
      setTodayCompletions(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SessionCompletion),
      );
    });

    const unsubscribeRecentComp = onSnapshot(qRecentComp, (snap) => {
      setRecentCompletions(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as SessionCompletion),
      );
    });

    const unsubscribeSalary = onSnapshot(salaryQuery, (snap) => {
      if (!snap.empty)
        setLatestSalary({
          id: snap.docs[0].id,
          ...snap.docs[0].data(),
        } as Salary);
    });

    const currentYear = new Date().getFullYear().toString();
    const yearlySalariesQuery = query(
      salaryRef,
      where("teacherId", "==", user.uid),
      where("month", ">=", `${currentYear}-01`),
      where("month", "<=", `${currentYear}-12`),
    );
    const unsubscribeYearlySalaries = onSnapshot(
      yearlySalariesQuery,
      (snap) => {
        setSalariesCount(snap.size);
      },
    );

    const qExtrasToday = query(
      collection(db, "extra_sessions"),
      where("teacherId", "==", user.uid),
      where("date", "==", todayStr),
    );
    const unsubscribeExtrasToday = onSnapshot(qExtrasToday, (snap) => {
      setExtraSessionsToday(
        snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ExtraSession),
      );
    });

    return () => {
      unsubscribeTeacher();
      unsubscribeClasses();
      unsubscribeTodayComp();
      unsubscribeRecentComp();
      unsubscribeSalary();
      unsubscribeYearlySalaries();
      unsubscribeExtrasToday();
    };
  }, [user]);

  const isOngoing = (startTime: string, endTime: string) => {
    const now = currentTime;
    const [h, m] = startTime.split(":").map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0);

    let end = new Date(now);
    if (endTime && endTime.includes(":")) {
      const [eh, em] = endTime.split(":").map(Number);
      end.setHours(eh, em + 15, 0);
    } else {
      end = new Date(start.getTime() + 120 * 60000);
    }

    return now >= start && now <= end;
  };

  const todayClasses = useMemo(() => {
    const todayStr = format(currentTime, "yyyy-MM-dd");
    const currentDay = format(currentTime, "EEEE").toLowerCase();

    const regularToday = allClasses.flatMap((cls) => {
      const slots = (cls.schedules || []).filter(
        (s) => s.dayOfWeek.toLowerCase() === currentDay,
      );
      return slots.map((slot) => {
        const startTimeSafe = slot.startTime.replace(/:/g, "-");
        const completionId = `${cls.id}_${todayStr}_${startTimeSafe}`;
        const completion = todayCompletions.find((c) => c.id === completionId);

        return {
          ...cls,
          currentSlot: slot,
          isCompleted: !!completion,
          isPaid: !!completion?.isPaid,
          isExtra: false,
        } as TodayClass;
      });
    });

    const extrasToday = extraSessionsToday.map((extra) => {
      const startTimeSafe = extra.startTime.replace(/:/g, "-");
      const completionId = `${extra.classId}_${todayStr}_${startTimeSafe}`;
      const completion = todayCompletions.find((c) => c.id === completionId);

      return {
        id: extra.classId,
        name: extra.className,
        grade: extra.grade,
        subject: extra.subject,
        currentSlot: {
          dayOfWeek: extra.date,
          startTime: extra.startTime,
          endTime: extra.endTime,
          room: extra.room,
        },
        isCompleted: !!completion,
        isPaid: !!completion?.isPaid,
        isExtra: true,
      } as TodayClass;
    });

    return [...regularToday, ...extrasToday].sort((a, b) =>
      a.currentSlot.startTime.localeCompare(b.currentSlot.startTime),
    );
  }, [currentTime, allClasses, todayCompletions, extraSessionsToday]);

  const stats = useMemo(() => {
    const totalPending = allClasses.reduce(
      (acc, curr) => acc + (curr.sessionsSinceLastPayment || 0),
      0,
    );
    const totalSessions = allClasses.reduce(
      (acc, curr) => acc + (curr.completedSessions || 0),
      0,
    );
    const tenureMonths = teacherData?.createdAt
      ? Math.floor(
          (new Date().getTime() - teacherData.createdAt.toDate().getTime()) /
            (1000 * 60 * 60 * 24 * 30.44),
        )
      : 0;

    return {
      totalStudents: allClasses.reduce(
        (acc, curr) => acc + (curr.studentCount || 0),
        0,
      ),
      activeClasses: allClasses.length,
      completedToday: todayCompletions.length,
      totalSessions,
      cyclesCompletedYear: salariesCount,
      pendingSessions: totalPending,
      tenureLabel:
        tenureMonths < 12
          ? `${tenureMonths} Months`
          : `${(tenureMonths / 12).toFixed(1)} Years`,
    };
  }, [allClasses, todayCompletions, salariesCount, teacherData]);

  const toggleClassCompletion = async (classItem: TodayClass) => {
    if (!user?.uid) return;

    if (classItem.isPaid) {
      toast.error("Transactional integrity: This session is already settled and cannot be modified.");
      return;
    }

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const startTimeSafe = (classItem.currentSlot?.startTime || "00-00").replace(
      /:/g,
      "-",
    );
    const completionId = `${classItem.id}_${todayStr}_${startTimeSafe}`;
    const isCurrentlyCompleted = classItem.isCompleted;

    const now = new Date();
    const [startH, startM] = (classItem.currentSlot?.startTime || "00:00")
      .split(":")
      .map(Number);
    const slotDT = new Date();
    slotDT.setHours(startH, startM, 0, 0);

    if (isAfter(slotDT, now) && !isCurrentlyCompleted) {
      toast.error("Early Access Restricted: Session logging is only available after the scheduled start time.");
      return;
    }

    try {
      const currentDay = format(new Date(), "EEEE").toLowerCase();
      const completionRef = doc(db, "session_completions", completionId);
      const classRef = doc(db, "classes", classItem.id);

      if (isCurrentlyCompleted) {
        const [freshClassSnap, completionSnap] = await Promise.all([
          getDoc(classRef),
          getDoc(completionRef),
        ]);

        const completionData = completionSnap.data();
        const freshPending =
          freshClassSnap.data()?.sessionsSinceLastPayment || 0;
        const batch = writeBatch(db);

        let pendingDelta = freshPending > 0 ? -1 : 0;
        if (completionData?.salaryId) {
          const salaryRef = doc(db, "salaries", completionData.salaryId);
          const salarySnap = await getDoc(salaryRef);
          if (salarySnap.exists() && salarySnap.data().status === "pending") {
            const sessionsCovered = salarySnap.data().sessionsConducted || 0;
            pendingDelta = sessionsCovered - 1;
            batch.delete(salaryRef);

            // 🚨 Revert Administrative Notifications
            const notifQ = query(
              collection(db, "notifications"),
              where("sourceId", "==", completionData.salaryId),
            );
            const notifSnap = await getDocs(notifQ);
            notifSnap.docs.forEach((ndoc) => batch.delete(ndoc.ref));

            const otherCompletionsQ = query(
              collection(db, "session_completions"),
              where("salaryId", "==", completionData.salaryId),
            );
            const otherCompletionsSnap = await getDocs(otherCompletionsQ);
            otherCompletionsSnap.docs.forEach((d) =>
              batch.update(doc(db, "session_completions", d.id), {
                salaryId: deleteField(),
              }),
            );
          }
        }
        batch.delete(completionRef);
        batch.update(classRef, {
          completedSessions: increment(-1),
          sessionsSinceLastPayment: increment(pendingDelta),
        });
        await batch.commit();
        toast.success("Session log removed: Stats have been updated.");
      } else {
        await setDoc(completionRef, {
          classId: classItem.id,
          className: classItem.name,
          teacherId: user.uid,
          teacherName: teacherData?.name || "Teacher",
          date: todayStr,
          dayOfWeek: currentDay,
          timestamp: serverTimestamp(),
          startTime: classItem.currentSlot?.startTime || "--:--",
          endTime: classItem.currentSlot?.endTime || "--:--",
          subject: classItem.subject,
          grade: classItem.grade,
          studentCount: classItem.studentCount || 0,
          isPaid: false,
          day: new Date().getDate(),
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        });
        await updateDoc(classRef, {
          completedSessions: increment(1),
          sessionsSinceLastPayment: increment(1),
        });
        toast.success("Session saved: Progress recorded.");

        try {
          const classQ = query(
            collection(db, "classes"),
            where("teacherId", "==", user.uid),
          );
          const freshClassesSnap = await getDocs(classQ);
          const freshClasses = freshClassesSnap.docs.map(
            (d) => ({ ...d.data(), id: d.id }) as Class,
          );
          if (
            freshClasses.some(
              (c) =>
                (c.sessionsSinceLastPayment || 0) >= (c.sessionsPerCycle || 8),
            )
          ) {
            const pr = await processTeacherPayroll(
              user.uid,
              teacherData?.name || "Teacher",
              freshClasses,
              undefined,
              completionId,
            );
            if (pr.success)
              toast.success("Month Finished: Payment request sent for review.", { icon: "💰" });
          }
        } catch (e) {}
      }
    } catch (e) {
      toast.error("Error: Could not save session.");
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton variant="text" width="200px" height="32px" />
          <Skeleton
            variant="rect"
            width="100px"
            height="40px"
            className="rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton
              key={i}
              variant="rect"
              width="100%"
              height="90px"
              className="rounded-2xl"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <Skeleton
            variant="rect"
            className="lg:col-span-7 rounded-[4rem]"
            height="500px"
          />
          <Skeleton
            variant="rect"
            className="lg:col-span-5 rounded-[3rem]"
            height="500px"
          />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Students",
      value: stats.totalStudents,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      title: "Classes",
      value: stats.activeClasses,
      icon: Projector,
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
    {
      title: "Done Today",
      value: stats.completedToday,
      icon: Clock,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      title: "Classes to Log",
      value: stats.pendingSessions,
      icon: History,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      title: "Paid Months",
      value: stats.cyclesCompletedYear,
      icon: Wallet,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
    {
      title: "Joined",
      value: stats.tenureLabel,
      icon: Briefcase,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* 🏛️ Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Dashboard
          </h1>
          <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider leading-none">
            {getGreeting()},{" "}
            <span className="text-indigo-600 font-black">
              {teacherData?.name?.split(" ")[0]}
            </span>{" "}
            • {format(currentTime, "hh:mm a")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExtraModalOpen(true)}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2 shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" /> Extra Class
          </button>
          <Link
            href="/teacher/salary"
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <History className="w-3.5 h-3.5 text-slate-400" /> My Salary
          </Link>
        </div>
      </div>

      {/* 🚀 Quick HUD Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-300 hover:border-indigo-300 group shadow-sm hover:shadow-xl"
          >
            <div className="flex flex-col gap-4">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg} ${card.color} group-hover:scale-110 transition-transform shadow-sm`}
              >
                <card.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  {card.title}
                </p>
                <p className="text-lg font-black text-slate-900 leading-none">
                  {card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 📊 My Classes Registry (Left - 7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-100/50 overflow-hidden flex flex-col group/table hover:border-indigo-100 transition-all duration-700">
          <div className="px-10 py-10 border-b border-slate-50 flex items-center justify-between bg-white relative">
            <div className="flex items-center gap-5">
              <div className="w-1.5 h-10 bg-indigo-600 rounded-full group-hover/table:scale-y-110 transition-transform shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
              <div>
                <h3 className="font-black text-slate-800 tracking-wider uppercase text-xs">
                  My Classes
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">
                  Class progress
                </p>
              </div>
            </div>
            <Link
              href="/teacher/ledger"
              className="w-12 h-12 rounded-[1.25rem] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group/link"
            >
              <TrendingUp className="w-6 h-6 group-hover/link:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="p-0 flex-1 overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap border-collapse">
              <thead className="bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Class Name</th>
                  <th className="px-8 py-5">Monthly Progress</th>
                  <th className="px-8 py-5 text-right">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allClasses.map((cls) => {
                  const cycleProgress = cls.sessionsSinceLastPayment || 0;
                  const cycleBenchmark = cls.sessionsPerCycle || 8;
                  const progressPct = Math.min(
                    100,
                    (cycleProgress / cycleBenchmark) * 100,
                  );

                  return (
                    <tr
                      key={cls.id}
                      className="hover:bg-indigo-50/30 transition-all duration-500 group/row"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black text-indigo-600 group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all shadow-inner border border-slate-100">
                            {cls.grade.charAt(0)}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-sm font-black text-slate-800 tracking-tight">
                              {cls.name}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              {cls.subject}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="space-y-2 w-32">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                            <span>
                              {cycleProgress} / {cycleBenchmark}
                            </span>
                            <span className="text-indigo-600">
                              {Math.round(progressPct)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full transition-all duration-1000 ${progressPct > 80 ? "bg-amber-500" : "bg-indigo-600"}`}
                              style={{ width: `${progressPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-slate-800 font-black text-sm">
                          {cls.studentCount || 0}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                          STUDENTS
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 📟 Today's Timeline (Right - 5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-indigo-100/5 transition-all duration-500">
          <div className="px-8 py-8 border-b border-slate-50 bg-white flex items-center justify-between relative group/timeline">
            <div className="flex items-center gap-5">
              <div className="w-1.5 h-10 bg-indigo-600 rounded-full group-hover/timeline:scale-y-110 transition-transform shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Schedule
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">
                  Today
                </p>
              </div>
            </div>
            <Link
              href="/teacher/timetable"
              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all"
            >
              View Schedule
            </Link>
          </div>

          <div className="p-8 flex-1">
            <div className="space-y-6 relative">
              {todayClasses.length > 0 ? (
                todayClasses.map((item, idx) => {
                  const active = isOngoing(
                    item.currentSlot.startTime,
                    item.currentSlot.endTime,
                  );
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="relative group flex gap-6"
                    >
                      {idx !== todayClasses.length - 1 && (
                        <div className="absolute left-[39px] top-10 bottom-[-24px] w-px bg-slate-100 group-hover:bg-indigo-50 transition-colors"></div>
                      )}

                      <div className="flex-shrink-0 w-24 flex flex-col items-center justify-center relative">
                        {item.isCompleted && (
                          <div className="absolute -left-3 top-0 text-emerald-500 animate-in zoom-in duration-500">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                        <div
                          className={`w-full py-2 rounded-xl border text-center transition-all ${item.isCompleted ? "bg-emerald-50 border-emerald-100 text-emerald-700" : active ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100" : "bg-slate-50 border-slate-100 text-slate-600"}`}
                        >
                          <p className="text-[11px] font-black tabular-nums">
                            {
                              formatTime(item.currentSlot.startTime).split(
                                " ",
                              )[0]
                            }
                          </p>
                          <p className="text-[8px] font-black opacity-60 uppercase tracking-widest">
                            {
                              formatTime(item.currentSlot.startTime).split(
                                " ",
                              )[1]
                            }
                          </p>
                        </div>
                        <div className="w-px h-3 bg-slate-100"></div>
                        <div
                          className={`px-2 py-1 rounded-lg border text-[9px] font-black text-center ${item.isCompleted ? "bg-emerald-50/50 border-emerald-100 text-emerald-400" : "bg-slate-50 border-slate-100 text-slate-400"}`}
                        >
                          {formatTime(item.currentSlot.endTime)}
                        </div>
                      </div>

                      <div
                        className={`flex-1 p-5 rounded-3xl border transition-all duration-500 ${item.isCompleted ? "bg-slate-50/80 border-slate-100 opacity-60 grayscale-[0.8]" : active ? "bg-white border-indigo-400 shadow-2xl shadow-indigo-100 ring-4 ring-indigo-50" : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-lg"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-black text-slate-900 text-sm truncate tracking-tight">
                            {item.name}
                          </h4>
                          {active && !item.isCompleted && (
                            <div className="flex items-center gap-1.5 text-[8px] font-black text-rose-500 uppercase animate-pulse tracking-widest">
                              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>{" "}
                              LIVE
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-x-4 gap-y-1 mb-4">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                            {item.grade}
                          </span>
                          <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-400" />{" "}
                            {item.currentSlot.room}
                          </span>
                        </div>

                        <button
                          onClick={() => toggleClassCompletion(item)}
                          disabled={item.isPaid}
                          className={`w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${item.isPaid ? "bg-amber-50 text-amber-500 border border-amber-100" : item.isCompleted ? "bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200" : "bg-slate-900 text-white hover:bg-indigo-600 shadow-lg shadow-slate-100 hover:shadow-indigo-100"}`}
                        >
                          {item.isPaid ? (
                            <Lock className="w-3 h-3" />
                          ) : item.isCompleted ? (
                            <RotateCcw className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {item.isPaid
                            ? "Settled"
                            : item.isCompleted
                              ? "Undo"
                              : "Complete Class"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-24 text-center space-y-4">
                  <Calendar className="w-12 h-12 text-slate-100 mx-auto" />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    No classes scheduled for today.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🔮 Teacher Status Radar */}
      <div className="bg-slate-900 rounded-[3.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden shadow-2xl group/hud">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] -mr-80 -mt-80 group-hover/hud:scale-110 transition-transform duration-[2000ms]"></div>
        <div className="flex flex-col sm:flex-row items-center gap-10 relative z-10 text-center sm:text-left">
          <div className="w-20 h-20 bg-white/10 rounded-[2.5rem] border border-white/5 flex items-center justify-center text-indigo-400 shadow-2xl backdrop-blur-xl">
            <Activity className="w-10 h-10 animate-pulse" />
          </div>
          <div>
            <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.4em] mb-3">
              Teacher Status
            </p>
            <h4 className="text-2xl font-black flex flex-wrap items-center justify-center sm:justify-start gap-4">
              Everything Synced:{" "}
              <span className="text-emerald-400 uppercase">
                {teacherData?.status || "ACTIVE"}
              </span>
              <div className="flex gap-1.5 h-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-indigo-400/30 rounded-full animate-bounce"
                    style={{
                      height: `${i * 20 + 20}%`,
                      animationDelay: `${i * 100}ms`,
                      animationDuration: "1000ms",
                    }}
                  ></div>
                ))}
              </div>
            </h4>
            <p className="text-[10px] font-medium text-white/30 mt-3 uppercase tracking-widest leading-none">
              Institutional standard compliance: 100% • Verified Since:{" "}
              {teacherData?.createdAt
                ? format(teacherData.createdAt.toDate(), "yyyy")
                : "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-12 relative z-10 border-t md:border-t-0 md:border-l border-white/10 pt-10 md:pt-0 md:pl-12">
          <div className="text-center group-hover/hud:translate-y-[-4px] transition-transform duration-500">
            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mb-2 leading-none">
              Total Finished
            </p>
            <p className="text-3xl font-black tracking-tighter tabular-nums leading-none">
              {stats.totalSessions}
              <span className="text-sm ml-1 opacity-40">logs</span>
            </p>
            <p className="text-[8px] font-bold text-emerald-400 mt-2.5 uppercase tracking-widest opacity-80 flex items-center justify-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
              TOTAL CLASSES COMPLETED
            </p>
          </div>
          <div className="w-px h-16 bg-white/10 hidden xl:block"></div>
          <div className="text-center group-hover/hud:translate-y-[-4px] transition-transform duration-500 delay-75">
            <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mb-2 leading-none">
              System Latency
            </p>
            <p className="text-[11px] font-black text-indigo-400 flex items-center gap-3 uppercase tracking-[0.2em] leading-none">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_15px_rgba(129,140,248,0.8)]"></span>
              Matrix Online
            </p>
            <p className="text-[8px] font-bold text-white/20 mt-1.5 uppercase tracking-tighter">
              Verified Node: Colombo Hub
            </p>
          </div>
        </div>
      </div>

      <ExtraSessionModal
        isOpen={isExtraModalOpen}
        onClose={() => setIsExtraModalOpen(false)}
        onSuccess={() => {}}
        classes={allClasses}
        preselectedDate={currentTime}
      />
    </div>
  );
}
