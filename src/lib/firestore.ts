import { collection, query, getDocs, where, limit, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { format } from "date-fns";

import { DashboardStats, DashboardStudent, DashboardTimetableSlot } from "@/types/dashboard";

export async function getDashboardStats(): Promise<DashboardStats> {
  const [studentsSnap, teachersSnap, classesSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "teachers")),
    getDocs(collection(db, "classes"))
  ]);

  const totalStudents = studentsSnap.size;
  const totalTeachers = teachersSnap.size;
  const activeClassesCount = classesSnap.docs.filter(d => d.data().status === "active").length;

  const currentMonthStr = format(new Date(), "yyyy-MM");
  const pmtsSnap = await getDocs(query(collection(db, "payments"), where("month", "==", currentMonthStr)));
  
  let feesCollected = 0;
  let unpaidFeesCount = 0;
  pmtsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.status === "paid" || data.status === "partial") feesCollected += data.paidAmount || 0;
    if (data.status === "unpaid" || data.status === "partial") unpaidFeesCount += 1;
  });

  const recentSnap = await getDocs(query(collection(db, "students"), orderBy("createdAt", "desc"), limit(5)));
  const recentStudents = recentSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardStudent));

  const todayObj = new Date();
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayOfWeek = days[todayObj.getDay()];
  
  const timetable: any[] = [];
  classesSnap.docs.forEach(doc => {
    const cls = doc.data();
    if (cls.status !== "active") return;
    const todaySlots = (cls.schedules || []).filter((s: any) => s.dayOfWeek.toLowerCase() === dayOfWeek);
    todaySlots.forEach((slot: any) => {
      timetable.push({
        id: `${doc.id}-${slot.startTime}`,
        className: cls.name,
        teacherName: cls.teacherName,
        startTime: slot.startTime,
        room: slot.room || "Main Hall",
        grade: cls.grade
      });
    });
  });

  return {
    totalStudents,
    totalTeachers,
    feesCollected,
    unpaidFeesCount,
    activeClassesCount,
    recentStudents,
    timetable: timetable.sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 5)
  };
}
