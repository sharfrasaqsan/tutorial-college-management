import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "./src/lib/firebase";

async function fixNegativeSessions() {
    console.log("Starting data integrity scan...");
    try {
        const classQ = query(collection(db, "classes"), where("sessionsSinceLastPayment", "<", 0));
        const snap = await getDocs(classQ);
        
        console.log(`Found ${snap.size} corrupted class records.`);
        
        for (const classDoc of snap.docs) {
            const data = classDoc.data();
            console.log(`Fixing Class: ${data.name} (Current: ${data.sessionsSinceLastPayment})`);
            await updateDoc(doc(db, "classes", classDoc.id), {
                sessionsSinceLastPayment: 0
            });
            console.log(`✅ ${data.name} restored to baseline.`);
        }
        
        console.log("Cleanup complete.");
    } catch (e) {
        console.error("Integrity check failed:", e);
    }
}

// Since I can't run this directly easily without a proper environment, 
// I'll provide this as a reference or a one-time execution if I could.
// But I can't really "run" it in the background easily with imports without setup.
// I'll just inform the user.
