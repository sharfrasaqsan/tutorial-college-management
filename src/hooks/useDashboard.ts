import { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  where 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { DashboardStats, DashboardStudent, DashboardTimetableSlot } from "@/types/dashboard";
import { Class } from "@/types/models";

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const compareTimes = (a: { startTime: string }, b: { startTime: string }) => {
    const [h1, m1] = a.startTime.split(':').map(Number);
    const [h2, m2] = b.startTime.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  };

  useEffect(() => {
    // Temporal constants for all listeners
    const todayObj = new Date();
    const todayStr = format(todayObj, "yyyy-MM-dd");
    const currentMonthStr = format(todayObj, "yyyy-MM");
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayOfWeek = days[todayObj.getDay()];

    // 1. Listen for Students
    const studentsQ = collection(db, "students");
    const unsubscribeStudents = onSnapshot(studentsQ, (snapshot) => {
        const studentDocs = [...snapshot.docs].sort((a, b) => {
            const timeA = (a.data() as { createdAt?: { seconds: number } }).createdAt?.seconds || 0;
            const timeB = (b.data() as { createdAt?: { seconds: number } }).createdAt?.seconds || 0;
            return timeB - timeA;
        });

        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            totalStudents: snapshot.size,
            recentStudents: studentDocs
                .slice(0, 5)
                .map(d => ({ id: d.id, ...d.data() } as DashboardStudent))
        } as DashboardStats));
        setIsLoading(false);
    }, () => {
        setIsError(true);
        setIsLoading(false);
    });

    // 2. Listen for Teachers
    const teachersQ = collection(db, "teachers");
    const unsubscribeTeachers = onSnapshot(teachersQ, (snapshot) => {
        const teacherDocs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a: any, b: any) => a.name.localeCompare(b.name));

        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            totalTeachers: snapshot.size,
            teacherList: teacherDocs.map(d => ({
                id: d.id,
                name: d.name,
                teacherId: d.teacherId,
                subjects: d.subjects || [],
                phone: d.phone,
                status: d.status,
                photoURL: d.photoURL
            }))
        } as DashboardStats));
    });

    // 3. Listen for Classes (to calculate active classes and timetable)
    const classesQ = collection(db, "classes");
    const unsubscribeClasses = onSnapshot(classesQ, (snapshot) => {
        const classes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        const activeClassesCount = classes.filter((c: Class) => c.status === "active").length;
        
        const timetable: DashboardTimetableSlot[] = [];
        classes.forEach((cls: Class) => {
            if (cls.status !== "active") return;
            const todaySlots = (cls.schedules || []).filter((s) => s.dayOfWeek.toLowerCase() === dayOfWeek);
            todaySlots.forEach((slot) => {
                timetable.push({
                    id: `${cls.id}|${slot.startTime}`,
                    className: cls.name,
                    teacherName: cls.teacherName,
                    startTime: slot.startTime,
                    endTime: slot.endTime || "",
                    room: slot.room || "Main Hall",
                    grade: cls.grade
                });
            });
        });

        setStats(prev => {
            const extraSlots = (prev?.timetable || []).filter(s => (s as any).isExtra);
            const combined = [...timetable, ...extraSlots].sort(compareTimes);
            return {
                ...(prev || {} as DashboardStats),
                activeClassesCount,
                timetable: combined,
                studentBreakdown: classes.map(c => ({
                    id: c.id,
                    name: c.name,
                    grade: c.grade,
                    studentCount: c.studentCount || 0,
                    teacherName: c.teacherName
                })).sort((a, b) => a.grade.localeCompare(b.grade) || b.studentCount - a.studentCount)
            } as DashboardStats;
        });
    });

    // 4. Listen for current month's payments
    const paymentsQ = query(collection(db, "payments"), where("month", "==", currentMonthStr));
    const unsubscribePayments = onSnapshot(paymentsQ, (snapshot) => {
        let feesCollected = 0;
        let unpaidFeesCount = 0;
        const paymentList: any[] = [];
        const unpaidList: any[] = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === "paid" || data.status === "partial") feesCollected += data.paidAmount || 0;
            
            paymentList.push({
                id: doc.id,
                studentName: data.studentName,
                amount: data.paidAmount || 0,
                status: data.status,
                date: data.paymentDate || data.createdAt || ""
            });

            if (data.status === "unpaid" || data.status === "partial") {
                unpaidFeesCount += 1;
                unpaidList.push({
                    id: doc.id,
                    studentName: data.studentName,
                    amount: data.balanceAmount || data.totalAmount || 0,
                    month: data.month
                });
            }
        });

        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            feesCollected,
            unpaidFeesCount,
            monthlyPayments: paymentList.sort((a, b) => b.date.localeCompare(a.date)),
            unpaidList: unpaidList.sort((a, b) => a.studentName.localeCompare(b.studentName))
        } as DashboardStats));
    });

    // 5. Listen for Subjects
    const subjectsQ = collection(db, "subjects");
    const unsubscribeSubjects = onSnapshot(subjectsQ, (snapshot) => {
        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            totalSubjects: snapshot.size
        } as DashboardStats));
    });

    // 6. Listen for Pending Salaries
    const salariesQ = query(collection(db, "salaryRequests"), where("status", "==", "pending"));
    const unsubscribeSalaries = onSnapshot(salariesQ, (snapshot) => {
        const salaryList = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                teacherName: data.teacherName,
                amount: data.totalAmount || 0,
                requestDate: data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : ""
            };
        }).sort((a, b) => b.requestDate.localeCompare(a.requestDate));

        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            pendingSalariesCount: snapshot.size,
            salaryList
        } as DashboardStats));
    });

    // 7. Listen for Extra Sessions
    const extrasQ = query(collection(db, "extra_sessions"), where("date", "==", todayStr));
    const unsubscribeExtras = onSnapshot(extrasQ, (snapshot) => {
        const extraSlots = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: (data.classId || doc.id) + "|" + data.startTime,
                className: data.className,
                teacherName: data.teacherName,
                startTime: data.startTime,
                endTime: data.endTime || "",
                room: data.room || "Main Hall",
                grade: data.grade,
                isExtra: true
            };
        });

        setStats(prev => {
            if (!prev) return prev;
            const regularTimetable = (prev.timetable || []).filter(s => !(s as any).isExtra);
            const combined = [...regularTimetable, ...extraSlots].sort(compareTimes);
            return {
                ...prev,
                timetable: combined
            } as DashboardStats;
        });
    });

    // 8. Listen for Session Completions (Today)
    const completionsQ = query(collection(db, "session_completions"), where("date", "==", todayStr));
    const unsubscribeCompletions = onSnapshot(completionsQ, (snapshot) => {
        const ids = new Set(snapshot.docs.map(doc => {
            const data = doc.data();
            const startTimeSafe = data.startTime.replace(/:/g, '-');
            return `${data.classId}_${startTimeSafe}`;
        }));
        setCompletedSessionIds(ids);
    });

    return () => {
        unsubscribeStudents();
        unsubscribeTeachers();
        unsubscribeClasses();
        unsubscribePayments();
        unsubscribeSubjects();
        unsubscribeSalaries();
        unsubscribeCompletions();
        unsubscribeExtras();
    };
  }, []);

  const enrichedStats = useMemo(() => {
    if (!stats) return null;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    
    const enrichedTimetable = stats.timetable.map(slot => {
        const [classId] = slot.id.split('|');
        const slotStartTimeSafe = slot.startTime.replace(/:/g, '-');
        const key = `${classId}_${slotStartTimeSafe}`;
        return {
          ...slot,
          isCompleted: completedSessionIds.has(key)
        };
    });

    const totalSessions = enrichedTimetable.length;
    const completedSessions = enrichedTimetable.filter(s => s.isCompleted).length;
    const academicIndex = totalSessions > 0 
        ? Math.round((completedSessions / totalSessions) * 1000) / 10 
        : 100;

    return {
      ...stats,
      timetable: enrichedTimetable,
      academicIndex,
      sessionStats: {
        totalSessions,
        completedSessions
      }
    };
  }, [stats, completedSessionIds]);

  return {
    stats: enrichedStats,
    isLoading,
    isError
  };
}
