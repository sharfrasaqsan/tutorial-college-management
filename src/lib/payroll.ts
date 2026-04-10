import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { Class, Teacher, Salary } from "@/types/models";

export interface TeacherPayrollResult {
    success: boolean;
    salaryId?: string;
    error?: string;
}

/**
 * Automatically or manually processes payroll for a teacher based on their current pending sessions.
 * Resets the sessionsSinceLastPayment counter for all processed classes.
 */
export async function processTeacherPayroll(
    teacherId: string, 
    teacherName: string, 
    classes: Class[],
    month: string = new Date().toISOString().substring(0, 7)
): Promise<TeacherPayrollResult> {
    const batch = writeBatch(db);
    
    try {
        const pendingClasses = classes.filter(c => (c.sessionsSinceLastPayment || 0) > 0);
        
        if (pendingClasses.length === 0) {
            return { success: false, error: "No pending sessions to process." };
        }

        const breakdown = pendingClasses.map(cls => {
            const studentCount = cls.studentCount || 0;
            const monthlyFee = cls.monthlyFee || 0;
            const sessionsConducted = cls.sessionsSinceLastPayment || 0;
            const totalMonthlyRevenue = studentCount * monthlyFee;
            const perSessionRate = totalMonthlyRevenue / 8;
            const finalPayout = Math.round(perSessionRate * sessionsConducted);

            return {
                classId: cls.id,
                className: cls.name,
                monthlyFee,
                studentCount,
                totalMonthlyRevenue,
                sessionsConducted,
                perSessionRate,
                finalPayout
            };
        });

        const totalNet = breakdown.reduce((sum, item) => sum + item.finalPayout, 0);
        const salaryRef = doc(collection(db, "salaries"));
        
        const salaryDoc = {
            teacherId,
            teacherName,
            month,
            status: "pending",
            basicAmount: totalNet,
            netAmount: totalNet,
            breakdown,
            createdAt: serverTimestamp(),
            processedAt: serverTimestamp(),
            paymentMethod: "Bank Transfer",
            type: "automatic" // or "manual" depending on caller, but we'll flag it
        };

        // 1. Create the salary record
        batch.set(salaryRef, salaryDoc);

        // 2. Reset sessionsSinceLastPayment for all processed classes
        pendingClasses.forEach(cls => {
            batch.update(doc(db, "classes", cls.id), {
                sessionsSinceLastPayment: 0
            });
        });

        await batch.commit();
        return { success: true, salaryId: salaryRef.id };
    } catch (error) {
        console.error("Payroll processing error:", error);
        return { success: false, error: "Failed to process payroll batch." };
    }
}
