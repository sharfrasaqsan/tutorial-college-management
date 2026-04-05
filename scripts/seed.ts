import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function seed() {
  console.log("Seeding started...");

  try {
    // === Add Admin User ===
    const adminEmail = "admin@tutorial.edu";
    try {
      const existingUser = await auth.getUserByEmail(adminEmail);
      console.log("Admin user already exists:", existingUser.uid);
      await db.collection("users").doc(existingUser.uid).set({
        uid: existingUser.uid,
        name: "Super Admin",
        email: adminEmail,
        role: "admin",
        phone: "0771234567",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err: unknown) {
      const e = err as { code: string };
      if (e.code === "auth/user-not-found") {
        const userRecord = await auth.createUser({
          email: adminEmail,
          password: "password123",
          displayName: "Super Admin",
        });
        await db.collection("users").doc(userRecord.uid).set({
          uid: userRecord.uid,
          name: "Super Admin",
          email: adminEmail,
          role: "admin",
          phone: "0771234567",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log("Created Admin User:", userRecord.uid);
      }
    }

    // === Grades ===
    const grades = [
      { name: "Grade 9", level: "junior" },
      { name: "Grade 10", level: "OL" },
      { name: "A/L Science", level: "AL" },
    ];
    
    const gradesRef = db.collection("grades");
    const gradeDocs = [];
    for (const g of grades) {
      const docRef = gradesRef.doc();
      await docRef.set({
        ...g,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      gradeDocs.push({ id: docRef.id, ...g });
    }
    console.log("Seeded Grades");

    // === Subjects ===
    const subjects = [
      { name: "Mathematics", gradeId: gradeDocs[0].id, medium: "sinhala" },
      { name: "Science", gradeId: gradeDocs[0].id, medium: "english" },
      { name: "History", gradeId: gradeDocs[1].id, medium: "sinhala" },
      { name: "Physics", gradeId: gradeDocs[2].id, medium: "english" },
      { name: "Chemistry", gradeId: gradeDocs[2].id, medium: "english" },
    ];

    const subjectsRef = db.collection("subjects");
    const subjectDocs = [];
    for (const s of subjects) {
      const docRef = subjectsRef.doc();
      await docRef.set({
        ...s,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      subjectDocs.push({ id: docRef.id, ...s });
    }
    console.log("Seeded Subjects");

    // === Teachers ===
    const teachersData = [
      { name: "Mr. Nimal Perera", email: "nimal@tutorial.edu", phone: "0712223334", nic: "801234567V", address: "Kandy", status: "active" },
      { name: "Ms. Sunethra Silva", email: "sunethra@tutorial.edu", phone: "0773334445", nic: "852345678V", address: "Colombo", status: "active" },
      { name: "Dr. Liyanage", email: "liyanage@tutorial.edu", phone: "0724445556", nic: "703456789V", address: "Galle", status: "active" },
    ];

    const teacherDocs = [];
    for (const t of teachersData) {
      let uid;
      try {
        const tr = await auth.getUserByEmail(t.email);
        uid = tr.uid;
      } catch (err: unknown) {
        const e = err as { code: string };
        if (e.code === "auth/user-not-found") {
          const userRec = await auth.createUser({
            email: t.email,
            password: "password123",
            displayName: t.name,
          });
          uid = userRec.uid;
          
          await db.collection("users").doc(uid).set({
            uid: uid,
            name: t.name,
            email: t.email,
            role: "teacher",
            phone: t.phone,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
      
      if(uid) {
        const docRef = db.collection("teachers").doc(uid); // Use uid as teacherId
        await docRef.set({
          uid: uid,
          name: t.name,
          email: t.email,
          phone: t.phone,
          nic: t.nic,
          address: t.address,
          subjectSpecializations: [subjectDocs[Math.floor(Math.random() * subjectDocs.length)].id],
          joinedDate: admin.firestore.FieldValue.serverTimestamp(),
          status: t.status,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        teacherDocs.push({ id: uid, ...t });
      }
    }
    console.log("Seeded Teachers");

    // === Classes ===
    const classesData = [];
    for (let i = 0; i < 8; i++) {
      const g = gradeDocs[Math.floor(Math.random() * gradeDocs.length)];
      const s = subjectDocs[Math.floor(Math.random() * subjectDocs.length)];
      const t = teacherDocs[Math.floor(Math.random() * teacherDocs.length)];
      const c = {
        name: `${g.name} ${s.name} - Group ${String.fromCharCode(65 + i)}`,
        gradeId: g.id,
        subjectId: s.id,
        teacherId: t.id,
        medium: ["sinhala", "english", "tamil"][Math.floor(Math.random() * 3)],
        maxCapacity: 30,
        monthlyFee: 2000 + Math.floor(Math.random() * 2000), // 2000 - 4000
        status: "active",
      };
      const docRef = db.collection("classes").doc();
      await docRef.set({
        ...c,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      classesData.push({ id: docRef.id, ...c });
    }
    console.log("Seeded Classes");

    // === Students ===
    const studentsRef = db.collection("students");
    const studentDocs = [];
    for (let i = 0; i < 15; i++) {
      const docRef = studentsRef.doc();
      const s = {
        name: `Student ${i+1}`,
        dateOfBirth: admin.firestore.Timestamp.fromDate(new Date(2005 + (i%5), Math.floor(Math.random()*12), 1)),
        gender: i % 2 === 0 ? "male" : "female",
        phone: `07${Math.floor(10000000 + Math.random() * 90000000)}`,
        parentName: `Parent ${i+1}`,
        parentPhone: `07${Math.floor(10000000 + Math.random() * 90000000)}`,
        address: `No ${i*10}, Road, City`,
        schoolName: `National School ${i % 3}`,
        enrolledClasses: [classesData[Math.floor(Math.random() * classesData.length)].id],
        status: "active",
      };
      await docRef.set({
        ...s,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      studentDocs.push({ id: docRef.id, ...s });
    }
    console.log("Seeded Students");

    // === Timetable Slots ===
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    for(const c of classesData) {
      const docRef = db.collection("timetable").doc();
      await docRef.set({
        classId: c.id,
        teacherId: c.teacherId,
        gradeId: c.gradeId,
        subjectId: c.subjectId,
        dayOfWeek: days[Math.floor(Math.random() * days.length)],
        startTime: "15:00",
        endTime: "17:00",
        room: `Room ${Math.floor(Math.random() * 5) + 1}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log("Seeded Timetable");

    // === Current Month Setups ===
    const currentMonth = "2026-04"; // using timestamp specified in context or dynamic: format(new Date(), "yyyy-MM")
    
    // === Payments ===
    const paymentsRef = db.collection("payments");
    for(let i=0; i<10; i++) {
      const std = studentDocs[i];
      const cls = classesData.find(c => c.id === std.enrolledClasses[0]);
      if(cls) {
        const docRef = paymentsRef.doc();
        const status = i % 3 === 0 ? "unpaid" : (i % 3 === 1 ? "partial" : "paid");
        const paidAmt = status === "paid" ? cls.monthlyFee : (status === "partial" ? cls.monthlyFee / 2 : 0);
        await docRef.set({
          studentId: std.id,
          classId: cls.id,
          month: currentMonth,
          amount: cls.monthlyFee,
          status: status,
          paidAmount: paidAmt,
          paidDate: status !== "unpaid" ? admin.firestore.FieldValue.serverTimestamp() : null,
          paymentMethod: "cash",
          notes: "Seeded Payment",
          recordedBy: "admin",
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    console.log("Seeded Payments");

    console.log("Seeding Complete!");
    process.exit(0);

  } catch (error) {
    console.error("Seeding Error:", error);
    process.exit(1);
  }
}

seed();
