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
  status: 'active' | 'inactive';
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
  createdAt: FirestoreTimestamp;
}

export interface Salary {
  id: string;
  teacherId: string;
  teacherName: string;
  month: string;
  basicAmount: number;
  netAmount: number;
  status: string;
  createdAt: FirestoreTimestamp;
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
}

export interface Grade {
  id: string;
  name: string;
  level: string;
  studentCount?: number;
  classCount?: number;
  status: 'active' | 'inactive';
}
