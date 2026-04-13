import { collection, doc, writeBatch, serverTimestamp, query, where, getDocs, increment } from "firebase/firestore";
import { db } from "./firebase";
import { Class } from "@/types/models";
import { notifyAdmins } from "@/hooks/useNotifications";

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
    month: string = new Date().toISOString().substring(0, 7),
    newSessionId?: string
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

            // Unique salary ID: teacher-class-month-timestamp
            const salaryId = `${teacherId}-${cls.id}-${month}-${Date.now()}`;
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

            // 3. Tag only UNPAID session completions for this class with the salary ID
            const completionsQ = query(
                collection(db, "session_completions"),
                where("classId", "==", cls.id),
                where("teacherId", "==", teacherId),
                where("isPaid", "==", false)
            );
            const completionsSnap = await getDocs(completionsQ);
            
            // Use a Set to avoid duplicate updates if newSessionId was already in the query result
            const completionIds = new Set(completionsSnap.docs.map(doc => doc.id));
            if (newSessionId) {
                // Only add if it belongs to this class (to avoid tagging other classes in the multi-class loop)
                // Logic: check the filename prefix or just trust that the UI only passes relevant ID
                // Safer: just check if the newSessionId starts with this classId
                if (newSessionId.startsWith(cls.id)) {
                    completionIds.add(newSessionId);
                }
            }

            completionIds.forEach(id => {
                batch.update(doc(db, "session_completions", id), {
                    salaryId: salaryId
                });
            });

            await batch.commit();

            // Notify Admin
            await notifyAdmins({
                title: "Class Cycle Finalized",
                message: `${teacherName} has completed the cycle for ${cls.name}. Payroll record for ${month} is pending authorization.`,
                type: "success",
                link: "/admin/salaries",
                sourceId: salaryId
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Payroll processing error:", error);
        return { success: false, error: "Failed to process payroll batch." };
    }
}
