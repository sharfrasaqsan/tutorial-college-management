import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs, increment } from "firebase/firestore";
import { db } from "./firebase";
import { Class } from "@/types/models";

export interface TeacherPayrollResult {
    success: boolean;
    salaryId?: string;
    error?: string;
}

/**
 * Processes payroll for a single class that has reached its session milestone.
 * Creates one salary record per class, locks sessions, and decrements the counter.
 */
export async function processTeacherPayroll(
    teacherId: string, 
    teacherName: string, 
    classes: Class[],
    month: string = new Date().toISOString().substring(0, 7)
): Promise<TeacherPayrollResult> {
    
    try {
        // Find the class(es) that reached the milestone
        const readyClasses = classes.filter(c => 
            (c.sessionsSinceLastPayment || 0) >= (c.sessionsPerCycle || 8)
        );
        
        if (readyClasses.length === 0) {
            return { success: false, error: "No classes have reached their session milestone." };
        }

        // Process each ready class as a separate salary record (1 class = 1 salary)
        for (const cls of readyClasses) {
            const batch = writeBatch(db);

            const studentCount = cls.studentCount || 0;
            const monthlyFee = cls.monthlyFee || 0;
            const sessionsConducted = cls.sessionsSinceLastPayment || 0;
            const totalMonthlyRevenue = studentCount * monthlyFee;
            const cycleValue = cls.sessionsPerCycle || 8;
            const perSessionRate = cycleValue > 0 ? totalMonthlyRevenue / cycleValue : 0;
            const finalPayout = Math.round(perSessionRate * sessionsConducted);

            // Unique salary ID: teacher-class-month
            const salaryId = `${teacherId}-${cls.id}-${month}`;
            const salaryRef = doc(db, "salaries", salaryId);
            
            const salaryDoc = {
                teacherId,
                teacherName,
                classId: cls.id,
                className: cls.name,
                month,
                status: "pending",
                sessionsConducted,
                sessionsPerCycle: cycleValue,
                monthlyFee,
                studentCount,
                totalMonthlyRevenue,
                perSessionRate,
                basicAmount: finalPayout,
                netAmount: finalPayout,
                createdAt: serverTimestamp(),
                processedAt: serverTimestamp(),
                paymentMethod: "Bank Transfer",
                type: "automatic"
            };

            // 1. Create the salary record
            batch.set(salaryRef, salaryDoc);

            // 2. Decrement sessionsSinceLastPayment (don't hard-reset to 0, preserve any new sessions)
            batch.update(doc(db, "classes", cls.id), {
                sessionsSinceLastPayment: increment(-sessionsConducted)
            });

            // 3. Lock all unpaid session completions for this class
            const completionsQ = query(
                collection(db, "session_completions"),
                where("classId", "==", cls.id),
                where("teacherId", "==", teacherId)
            );
            const completionsSnap = await getDocs(completionsQ);
            completionsSnap.docs.forEach(compDoc => {
                const data = compDoc.data();
                if (!data.isPaid) {
                    batch.update(doc(db, "session_completions", compDoc.id), {
                        isPaid: true,
                        salaryId: salaryId
                    });
                }
            });

            await batch.commit();
        }

        return { success: true };
    } catch (error) {
        console.error("Payroll processing error:", error);
        return { success: false, error: "Failed to process payroll batch." };
    }
}
