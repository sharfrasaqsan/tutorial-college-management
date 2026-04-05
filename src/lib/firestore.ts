import { collection, query, getDocs, where, limit, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { format } from "date-fns";

import { DashboardStats, DashboardStudent, DashboardTimetableSlot } from "@/types/dashboard";

export async function getDashboardStats(): Promise<DashboardStats> {
  const studentsSnap = await getDocs(collection(db, "students"));
  const totalStudents = studentsSnap.size;

  const teachersSnap = await getDocs(collection(db, "teachers"));
  const totalTeachers = teachersSnap.size;

  const currentMonthStr = format(new Date(), "yyyy-MM");
  
  const paymentsRef = collection(db, "payments");
  const pmtsQ = query(paymentsRef, where("month", "==", currentMonthStr));
  const pmtsSnap = await getDocs(pmtsQ);
  
  let feesCollected = 0;
  let unpaidFeesCount = 0;

  pmtsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.status === "paid" || data.status === "partial") {
      feesCollected += data.paidAmount || 0;
    }
    if (data.status === "unpaid" || data.status === "partial") {
      unpaidFeesCount += 1;
    }
  });

  // Recent students
  const recentStudentsQ = query(collection(db, "students"), orderBy("createdAt", "desc"), limit(5));
  const recentSnap = await getDocs(recentStudentsQ);
  const recentStudents = recentSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardStudent));

  // Today's timetable
  const todayObj = new Date();
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayOfWeek = days[todayObj.getDay()];
  
  const timetableQ = query(collection(db, "timetable"), where("dayOfWeek", "==", dayOfWeek), limit(5));
  const ttSnap = await getDocs(timetableQ);
  const timetable = ttSnap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardTimetableSlot));

  return {
    totalStudents,
    totalTeachers,
    feesCollected,
    unpaidFeesCount,
    recentStudents,
    timetable
  };
}
