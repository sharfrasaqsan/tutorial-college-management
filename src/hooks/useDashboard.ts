import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  onSnapshot, 
  where 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { DashboardStats, DashboardStudent } from "@/types/dashboard";
import { Class } from "@/types/models";

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
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
        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            totalTeachers: snapshot.size
        } as DashboardStats));
    });

    // 3. Listen for Classes (to calculate active classes and timetable)
    const classesQ = collection(db, "classes");
    const unsubscribeClasses = onSnapshot(classesQ, (snapshot) => {
        const classes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Class));
        const activeClassesCount = classes.filter((c: Class) => c.status === "active").length;
        
        const todayObj = new Date();
        const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const dayOfWeek = days[todayObj.getDay()];
        
        const timetable: Array<{
            id: string,
            className: string,
            teacherName: string,
            startTime: string,
            room: string,
            grade: string
        }> = [];
        classes.forEach((cls: Class) => {
            if (cls.status !== "active") return;
            const todaySlots = (cls.schedules || []).filter((s) => s.dayOfWeek.toLowerCase() === dayOfWeek.toLowerCase());
            todaySlots.forEach((slot) => {
                timetable.push({
                    id: `${cls.id}-${slot.startTime}`,
                    className: cls.name,
                    teacherName: cls.teacherName,
                    startTime: slot.startTime,
                    room: slot.room || "Main Hall",
                    grade: cls.grade
                });
            });
        });

        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            activeClassesCount,
            timetable: timetable.sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 5)
        } as DashboardStats));
    });

    // 4. Listen for current month's payments
    const currentMonthStr = format(new Date(), "yyyy-MM");
    const paymentsQ = query(collection(db, "payments"), where("month", "==", currentMonthStr));
    const unsubscribePayments = onSnapshot(paymentsQ, (snapshot) => {
        let feesCollected = 0;
        let unpaidFeesCount = 0;
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === "paid" || data.status === "partial") feesCollected += data.paidAmount || 0;
            if (data.status === "unpaid" || data.status === "partial") unpaidFeesCount += 1;
        });

        setStats(prev => ({
            ...(prev || {} as DashboardStats),
            feesCollected,
            unpaidFeesCount
        } as DashboardStats));
    });

    return () => {
        unsubscribeStudents();
        unsubscribeTeachers();
        unsubscribeClasses();
        unsubscribePayments();
    };
  }, []);

  return {
    stats,
    isLoading,
    isError
  };
}
