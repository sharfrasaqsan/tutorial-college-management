export interface DashboardStudent {
  id: string;
  name: string;
  phone: string;
  schoolName: string;
  status: string;
}

export interface DashboardTimetableSlot {
  id: string;
  startTime: string;
  classId: string;
  room: string;
  teacherId: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  feesCollected: number;
  unpaidFeesCount: number;
  recentStudents: DashboardStudent[];
  timetable: DashboardTimetableSlot[];
}
