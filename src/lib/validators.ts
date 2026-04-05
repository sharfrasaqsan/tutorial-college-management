import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const studentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(1, "Phone is required"),
  parentName: z.string().min(1, "Parent name is required"),
  parentPhone: z.string().min(1, "Parent phone is required"),
  address: z.string().min(1, "Address is required"),
  schoolName: z.string().min(1, "School name is required"),
  enrolledClasses: z.array(z.string()).default([]),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const teacherSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().min(1, "Phone is required"),
  nic: z.string().min(1, "NIC is required"),
  address: z.string().min(1, "Address is required"),
  subjectSpecializations: z.array(z.string()).default([]),
  joinedDate: z.string().min(1, "Joined date is required"),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  gradeId: z.string().min(1, "Grade is required"),
  subjectId: z.string().min(1, "Subject is required"),
  teacherId: z.string().min(1, "Teacher is required"),
  medium: z.enum(["sinhala", "english", "tamil"]),
  maxCapacity: z.number().min(1, "Capacity must be at least 1"),
  monthlyFee: z.number().min(0, "Fee must be a valid number"),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const paymentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  classId: z.string().min(1, "Class is required"),
  month: z.string().min(1, "Month is required"),
  amount: z.number().min(0),
  paidAmount: z.number().min(0),
  status: z.enum(["paid", "unpaid", "partial"]),
  paymentMethod: z.enum(["cash", "bank_transfer", "other"]),
  notes: z.string().optional(),
});
