export interface DashboardStudent {
  id: string;
  name: string;
  phone: string;
  parentPhone: string;
  grade: string;
  schoolName: string;
  status: string;
  createdAt?: any;
}

export interface DashboardTimetableSlot {
  id: string;
  startTime: string;
  endTime: string;
  className: string;
  teacherName: string;
  grade: string;
  room: string;
  isCompleted?: boolean;
}

export interface ClassStudentBreakdown {
    id: string;
    name: string;
    grade: string;
    studentCount: number;
    teacherName: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  feesCollected: number;
  unpaidFeesCount: number;
  activeClassesCount: number;
  recentStudents: DashboardStudent[];
  timetable: DashboardTimetableSlot[];
  tomorrowTimetable?: DashboardTimetableSlot[];
  pendingPayments?: UnpaidDetail[];
  studentBreakdown?: ClassStudentBreakdown[];
  totalSubjects?: number;
  pendingSalariesCount?: number;
  teacherList?: TeacherDetail[];
  monthlyPayments?: PaymentDetail[];
  unpaidList?: UnpaidDetail[];
  salaryList?: SalaryRequestDetail[];
  academicIndex?: number;
  sessionStats?: {
    totalSessions: number;
    completedSessions: number;
  };
}

export interface UnpaidDetail {
    id: string;
    studentName: string;
    amount: number;
    month: string;
}

export interface SalaryRequestDetail {
    id: string;
    teacherName: string;
    className: string;
    amount: number;
    requestDate: string;
}

export interface PaymentDetail {
    id: string;
    studentName: string;
    amount: number;
    status: string;
    date: string;
}

export interface TeacherDetail {
    id: string;
    name: string;
    teacherId: string;
    subjects: string[];
    phone: string;
    status: string;
    photoURL?: string;
}
