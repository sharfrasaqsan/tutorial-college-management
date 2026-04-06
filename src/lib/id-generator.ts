import { db } from "./firebase";
import { doc, runTransaction, increment } from "firebase/firestore";

export async function generateId(type: "student" | "teacher"): Promise<string> {
  const prefix = type === "student" ? "STU" : "TEA";
  const counterRef = doc(db, "metadata", "counters");

  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    
    let currentNumber = 0;
    if (counterDoc.exists()) {
      currentNumber = counterDoc.data()[type] || 0;
    }

    const nextNumber = currentNumber + 1;
    const formattedId = `${prefix}-${nextNumber.toString().padStart(4, '0')}`;

    transaction.set(counterRef, { [type]: nextNumber }, { merge: true });

    return formattedId;
  });
}
