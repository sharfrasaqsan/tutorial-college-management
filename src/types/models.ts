export type FirestoreTimestamp = {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
} | null | undefined;

export interface Student {
  id: string;
  studentId?: string; // Format: STU-XXXX
  name: string;
  phone?: string;
  parentName: string;
  parentPhone: string;
  schoolName: string;
  address: string;
  gender: 'male' | 'female' | 'other';
  status: 'active' | 'inactive';
  grade?: string;
  gradeId?: string;
  enrolledYear?: number;      // e.g. 2026
  academicYear?: number;      // Current focus year (2026, 2027)
  enrolledSubjects?: string[]; // IDs of subjects
  enrolledClasses?: string[];  // IDs of classes
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface Teacher {
  id: string;
  teacherId?: string; // Format: TEA-XXXX
  name: string;
  phone: string;
  email: string;
  subjects: string[]; // List of subject names or IDs
  grades: string[];   // List of grade names or IDs
  photoURL?: string;
  assignedClasses?: string[];
  gender: 'male' | 'female' | 'other';
  status: 'active' | 'inactive';
  nic: string;
  address: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  completedCycles?: number;
}

export interface ClassSchedule {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  subjectId: string;
  grade: string;
  gradeId: string;
  teacherId: string;
  teacherName: string;
  schedules: ClassSchedule[];
  monthlyFee: number;
  studentCount?: number;
  completedSessions?: number;
  sessionsSinceLastPayment?: number;
  sessionsPerCycle?: number;
  status: 'active' | 'inactive';
  academicYear?: number;      // e.g. 2026
  syllabusCompleted?: boolean; 
  completedAt?: FirestoreTimestamp;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  completedCycles?: number;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  month: string;
  method: string;
  description: string;
  status: string;
  subject?: string;
  classId?: string;
  classIds?: string[];
  className?: string;
  classNames?: string[];
  subjects?: string[];
  items?: {
    name: string;
    subject: string;
    amount: number;
  }[];
  createdAt: FirestoreTimestamp;
}

export interface Salary {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  month: string; // Ledger cycle (YYYY-MM)
  sessionsConducted: number;
  sessionsPerCycle: number;
  monthlyFee: number;
  studentCount: number;
  totalMonthlyRevenue: number;
  perSessionRate: number;
  basicAmount: number; // calculated payout
  netAmount: number;   // final payout
  status: string;      // 'paid' | 'pending'
  createdAt: FirestoreTimestamp;
  cycleNumber?: number;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  className?: string;
  date: string;
  records: Record<string, boolean>;
  createdAt: FirestoreTimestamp;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
}

export interface Subject {
  id: string;
  name: string;
  subjectCode: string;
  studentCount?: number;
  color?: string;
  status: 'active' | 'inactive';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface Grade {
  id: string;
  name: string;
  level: string;
  studentCount?: number;
  classCount?: number;
  status: 'active' | 'inactive';
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}
