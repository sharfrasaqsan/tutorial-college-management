import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { Salary, Payment, Student } from "@/types/models";
import {
  formatMonthYear,
  formatDate,
  formatTime,
  formatPaymentMonth,
} from "./formatters";

export const generateSalaryPDF = async (salary: Salary) => {
  if (!salary) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [29, 158, 117]; // SmartAcademy Emerald
    const secondaryColor = [15, 23, 42]; // Slate 900
    const accentColor = [52, 211, 153]; // Emerald 400
    const mutedColor = [148, 163, 184]; // Slate 400

    // Fetch linked sessions for detailed log
    let sessionLogs: any[] = [];
    try {
      const completionsQ = query(
        collection(db, "session_completions"),
        where("salaryId", "==", salary.id),
      );
      const completionsSnap = await getDocs(completionsQ);
      sessionLogs = completionsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Manual sort to avoid index requirements
      sessionLogs.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.startTime || "").localeCompare(b.startTime || "");
      });
    } catch (e) {
      console.warn("Could not fetch session logs for PDF", e);
    }

    // Safely extract values
    const teacherName = (salary.teacherName || "Faculty Member").toUpperCase();
    const teacherId = salary.teacherId
      ? `FAC-0${salary.teacherId.slice(-3)}`
      : "FAC-XXX";
    const className = salary.className || "Standard Academic Session";
    const netAmount = salary.netAmount || 0;
    const sessionsConducted =
      salary.sessionsConducted || sessionLogs.length || 0;
    const perSessionRate = salary.perSessionRate || 0;
    const studentCount = salary.studentCount || 0;
    const payrollCycle = formatMonthYear(salary.month);
    const invoiceId = salary.id ? salary.id.slice(-8).toUpperCase() : "TEMP";
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 50, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 24);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("INSTITUTIONAL MANAGEMENT SYSTEM", 16, 32);

    // --- Receipt Badge ---
    doc.setFillColor(29, 158, 117); // Emerald
    doc.roundedRect(150, 15, 45, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("REMITTANCE ADVICE", 155, 23);
    doc.setFontSize(11);
    doc.text(`#SLY-${invoiceId}`, 155, 32);

    // --- Entity Info Section ---
    let currentY = 65;
    
    // College Info (Left)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("ISSUED BY", 15, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("SMART ACADEMY ADMINISTRATION", 15, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Official Financial Division", 15, currentY + 11);
    doc.text("Verified Institutional Document", 15, currentY + 16);

    // Teacher Info (Right)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("RECIPIENT FACULTY", 135, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(teacherName, 135, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${teacherId}`, 135, currentY + 11);
    doc.text(`Cycle: ${payrollCycle}`, 135, currentY + 16);

    // --- Financial Summary Bar ---
    currentY += 30;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, currentY, 180, 25, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, currentY, 180, 25);

    doc.setFontSize(8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("SETTLEMENT DATE", 25, currentY + 10);
    doc.text("PAYMENT STATUS", 85, currentY + 10);
    doc.text("NET DISBURSEMENT", 145, currentY + 10);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(formatDate(salary.createdAt), 25, currentY + 18);
    
    // Status Badge
    const isPaid = salary.status === 'paid';
    doc.setFillColor(isPaid ? 16 : 245, isPaid ? 185 : 158, isPaid ? 129 : 11);
    doc.roundedRect(85, currentY + 13, 25, 7, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(salary.status.toUpperCase(), 97.5, currentY + 17.5, { align: 'center' });

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(14);
    doc.text(`LKR ${netAmount.toLocaleString()}`, 145, currentY + 18);

    // --- Calculation Breakdown ---
    currentY += 40;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("EARNINGS BREAKDOWN", 15, currentY);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Subject/Class", "Quantity", "Unit Rate", "Subtotal"]],
      body: [
        [
          { content: `${className}`, styles: { fontStyle: "bold" } },
          `${sessionsConducted} Sessions`,
          `LKR ${perSessionRate.toLocaleString()}`,
          `LKR ${netAmount.toLocaleString()}`,
        ],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "center" },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
      styles: { fontSize: 8, cellPadding: 5 },
    });

    // --- Session logs if available ---
    if (sessionLogs.length > 0) {
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(10);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.text("INSTRUCTIONAL LOG", 15, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Date", "Schedule", "Grade/Subject", "Students", "Amount"]],
        body: sessionLogs.map(log => [
          log.date,
          log.endTime ? `${formatTime(log.startTime)} - ${formatTime(log.endTime)}` : formatTime(log.startTime),
          `${log.grade || "---"} • ${log.subject || "---"}`,
          `${log.studentCount || studentCount}`,
          `${perSessionRate.toLocaleString()}`,
        ]),
        theme: "striped",
        headStyles: {
          fillColor: [71, 85, 105],
          fontSize: 7,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 25 },
          1: { halign: "center", cellWidth: 35 },
          3: { halign: "center", cellWidth: 20 },
          4: { halign: "right", cellWidth: 25 },
        },
        styles: { fontSize: 7, cellPadding: 3 },
      });
    }

    // --- Security & Authenticity ---
    const finalY = Math.max((doc as any).lastAutoTable.finalY + 30, 250);
    
    // Verified Badge
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.circle(170, finalY - 15, 12, "S");
    doc.setFontSize(6);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("OFFICIAL", 170, finalY - 17, { align: "center" });
    doc.text("VERIFIED", 170, finalY - 13, { align: "center" });

    // Signatures
    doc.setDrawColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.line(15, finalY, 70, finalY);
    doc.line(120, finalY, 175, finalY);
    
    doc.setFontSize(7);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("AUTHORIZED SIGNATORY", 15, finalY + 5);
    doc.text("TEACHER ACKNOWLEDGEMENT", 120, finalY + 5);

    // --- Footer Credits ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(`System Generated on ${generationDate} • Verification Code: ${invoiceId}`, 15, 290);
    
    // Footer Attribution
    doc.setFont("helvetica", "normal");
    doc.text("SmartAcademy Institutional Portal • Automated Financial Service", 205, 290, { align: "right" });

    // --- Save File ---
    const filename = `Salary_Slip_${teacherName.split(' ')[0]}_${salary.month}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Critical PDF Generation Error:", error);
  }
};

export const generateStudentPaymentPDF = async (
  payment: Payment,
  studentName?: string,
  studentId?: string,
) => {
  if (!payment) return;

  try {
    const doc = new jsPDF();
    const secondaryColor = [30, 41, 59]; // Slate 800
    const mutedColor = [148, 163, 184]; // Slate 400

    // Metadata
    const invoiceId = payment.id ? payment.id.slice(-8).toUpperCase() : "TEMP";
    const receiptDate = formatDate(payment.createdAt || new Date()); 4                                                                                               
    const monthName = formatPaymentMonth(payment.month);
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(30, 41, 59); // Dark Slate
    doc.rect(0, 0, 210, 50, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 25);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("INSTITUTIONAL FEE COLLECTION", 16, 32);

    // --- Receipt Badge ---
    doc.setFillColor(16, 185, 129); // Emerald
    doc.roundedRect(150, 15, 45, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL RECEIPT", 155, 23);
    doc.setFontSize(12);
    doc.text(`#PAY-${invoiceId}`, 155, 32);

    // --- Entity Info Section ---
    let currentY = 65;
    
    // Academy Info (Left)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("COLLECTED BY", 15, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("SMART ACADEMY ACCOUNTS", 15, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Official Bursar's Office", 15, currentY + 11);
    doc.text("Verified Payment Record", 15, currentY + 16);

    // Student Info (Right)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("STUDENT RECIPIENT", 135, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(studentName?.toUpperCase() || "STUDENT", 135, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${studentId || "STD-XXX"}`, 135, currentY + 11);
    doc.text(`Cycle: ${monthName}`, 135, currentY + 16);

    // --- Amounts Summary Card ---
    currentY += 30;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, currentY, 180, 25, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, currentY, 180, 25);

    doc.setFontSize(8);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("TRANSACTION DATE", 25, currentY + 10);
    doc.text("PAYMENT CHANNEL", 85, currentY + 10);
    doc.text("AMOUNT SETTLED", 145, currentY + 10);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(receiptDate, 25, currentY + 18);
    doc.text(payment.method.toUpperCase(), 85, currentY + 18);

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(14);
    doc.text(`LKR ${payment.amount.toLocaleString()}`, 145, currentY + 18);

    // --- Items List ---
    currentY += 40;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("REMITTANCE DETAILS", 15, currentY);

    const bodyData =
      payment.items && payment.items.length > 0
        ? payment.items.map((item: any) => [
            {
              content: `${item.subject || "---"} • ${item.name || "---"}`,
              styles: { fontStyle: "bold" },
            },
            monthName,
            `LKR ${item.amount.toLocaleString()}`,
          ])
        : [
            [
              {
                content: `${payment.subject || "---"} • Monthly Fee`,
                styles: { fontStyle: "bold" },
              },
              monthName,
              `LKR ${payment.amount.toLocaleString()}`,
            ],
          ];

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Description", "Billing Cycle", "Settled Amount"]],
      body: bodyData as any,
      theme: "grid",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "center", cellWidth: 40 },
        2: { halign: "right", cellWidth: 40, fontStyle: "bold" },
      },
      styles: { fontSize: 8, cellPadding: 6, lineColor: [241, 245, 249] },
    });

    // --- Verification & Footer ---
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Thank you for choosing Smart Academy. This receipt is automatically generated and verified by the fiscal server.",
      15,
      finalY,
    );

    // --- Footer Credits ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 282, 210, 15, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(`System Verified on ${generationDate} • #ID-${invoiceId}`, 15, 290);
    
    doc.setFont("helvetica", "normal");
    doc.text("SmartAcademy Institutional Portal • Digital Receipt Service", 205, 290, { align: "right" });

    // --- Save File ---
    const filename = `Receipt_${studentName?.split(' ')[0]}_${monthName}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("PDF Generation Error:", error);
  }
};

export const generateStudentListPDF = async (
  students: any[],
  title: string,
  subtitle: string,
) => {
  if (!students || students.length === 0) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [30, 41, 59]; // Slate 800
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${title.toUpperCase()} • ${subtitle.toUpperCase()}`, 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL RECORDS: ${students.length}`, 160, 20);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 26);

    // --- Registry Table ---
    const bodyData = students.map((s, idx) => [
      idx + 1,
      s.studentId || "---",
      s.name,
      s.parentName || "—",
      s.parentPhone || s.phone || "—",
      s.schoolName || "—",
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["#", "Registry ID", "Student Name", "Primary Parent", "Contact", "Institution"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [71, 85, 105],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "center", cellWidth: 25 },
        2: { fontStyle: "bold", cellWidth: 45 },
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Authentic Institutional Registry`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Registry Division", 205, 290, { align: "right" });
    }

    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("List PDF Generation Error:", error);
  }
};

export const generateClassListPDF = async (
  classes: any[],
  title: string,
  subtitle: string,
) => {
  if (!classes || classes.length === 0) return;

  try {
    const doc = new jsPDF();
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${title.toUpperCase()} • ${subtitle.toUpperCase()}`, 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL GROUPS: ${classes.length}`, 160, 20);
    doc.text(`SYNC DATE: ${generationDate}`, 160, 26);

    // --- Table ---
    const bodyData = classes.map((c, idx) => {
      const schedules = (c.schedules || [])
        .map(
          (s: any) =>
            `${s.dayOfWeek.slice(0, 3).toUpperCase()} (${formatTime(s.startTime)})`,
        )
        .join(", ");

      return [
        idx + 1,
        c.name,
        c.subject || "—",
        c.teacherName || "—",
        c.studentCount || 0,
        schedules || "---",
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [["#", "Class Designation", "Subject", "Lead Instructor", "Capacity", "Time Slot"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [71, 85, 105],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { fontStyle: "bold", cellWidth: 40 },
        4: { halign: "center" },
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Official Class Directory Report`, 15, 290);
        
        doc.setFont("helvetica", "bold");
        doc.text("DEVELOPED BY: AM. SHARFRAS AQSAN (sharfrasaqsan@gmail.com • 0751230001)", 205, 290, { align: "right" });
    }

    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Class List PDF Generation Error:", error);
  }
};

export const generateMasterRosterPDF = async (
  students: any[],
  grades: any[],
  classes: any[],
) => {
  if (!students || students.length === 0) return;

  try {
    const doc = new jsPDF();
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("MASTER STUDENT ROSTER • COMPLETE ENROLLMENT DIRECTORY", 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`CENSUS SIZE: ${students.length}`, 160, 20);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 26);

    let currentY = 50;

    // Sort grades
    const sortedGrades = [...grades].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );

    for (const grade of sortedGrades) {
      const gradeClasses = classes.filter((c) => c.gradeId === grade.id);

      if (gradeClasses.length === 0) continue;

      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(grade.name.toUpperCase(), 15, currentY);
      currentY += 5;
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 0.5, "F");
      currentY += 10;

      for (const cls of gradeClasses) {
        const classStudents = students.filter((s) =>
          s.enrolledClasses?.includes(cls.id),
        );

        if (classStudents.length === 0) continue;

        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(
          `${cls.name} (${cls.subject || "General"}) • ${classStudents.length} ENROLLED`,
          15,
          currentY,
        );
        currentY += 4;

        autoTable(doc, {
          startY: currentY,
          head: [["#", "Registry ID", "Student Name", "Primary Contact", "Account Status"]],
          body: classStudents.map((s, idx) => [
            idx + 1,
            s.studentId || "---",
            s.name,
            s.parentPhone || s.phone || "---",
            s.status.toUpperCase(),
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [30, 41, 59],
            fontSize: 7,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { halign: "center", cellWidth: 25 },
            2: { fontStyle: "bold" },
            3: { halign: "center" },
            4: { halign: "center" },
          },
          styles: { fontSize: 8, cellPadding: 3, lineColor: [241, 245, 249] },
          margin: { left: 15, right: 15 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        if (currentY > 260) {
          doc.addPage();
          currentY = 20;
        }
      }
    }

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Official Master Roster Document`, 15, 290);
        
        doc.setFont("helvetica", "bold");
        doc.text("DEVELOPED BY: AM. SHARFRAS AQSAN (sharfrasaqsan@gmail.com • 0751230001)", 205, 290, { align: "right" });
    }

    doc.save(`Master_Roster_${generationDate.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Master Roster PDF Error:", error);
  }
};

export const generateMasterClassRegistryPDF = async (
  classes: any[],
  grades: any[],
) => {
  if (!classes || classes.length === 0) return;

  try {
    const doc = new jsPDF();
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("MASTER CLASS REGISTRY • COMPLETE INSTITUTIONAL ACADEMIC SCHEDULE", 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL GROUPS: ${classes.length}`, 160, 20);
    doc.text(`SYNC DATE: ${generationDate}`, 160, 26);

    let currentY = 50;

    // Sort grades
    const sortedGrades = [...grades].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );

    for (const grade of sortedGrades) {
      const gradeClasses = classes.filter((c) => c.gradeId === grade.id);

      if (gradeClasses.length === 0) continue;

      // Check page space
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(grade.name.toUpperCase(), 15, currentY);
      currentY += 5;
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 0.5, "F");
      currentY += 10;

      autoTable(doc, {
        startY: currentY,
        head: [["Class Designation", "Subject", "Lead Instructor", "Capacity", "Day & Time Slot"]],
        body: gradeClasses.map((c) => {
          const schedules = (c.schedules || [])
            .map(
              (s: any) =>
                `${s.dayOfWeek.slice(0, 3).toUpperCase()} (${formatTime(s.startTime)})`,
            )
            .join(", ");

          return [
            c.name,
            c.subject || "---",
            c.teacherName || "---",
            c.studentCount || 0,
            schedules || "---",
          ];
        }),
        theme: "striped",
        headStyles: {
          fillColor: [30, 41, 59],
          fontSize: 8,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 40 },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { halign: "center", cellWidth: 20 },
        },
        styles: { fontSize: 8, cellPadding: 4, lineColor: [241, 245, 249] },
        margin: { left: 15, right: 15 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Official Institutional Roster Directory`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Official Registry Archive", 205, 290, { align: "right" });
    }

    doc.save(`Master_Registry_${generationDate.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Master Class Registry PDF Error:", error);
  }
};

export const generateStudentAttendanceHistoryPDF = async (
  attendanceHistory: any[],
  student: any,
) => {
  if (!attendanceHistory || attendanceHistory.length === 0 || !student) return;

  try {
    const doc = new jsPDF();
    const secondaryColor = [30, 41, 59]; // Slate 800
    const mutedColor = [148, 163, 184]; // Slate 400
    const generationDate = formatDate(new Date());

    // Calculate Stats
    const totalSessions = attendanceHistory.length;
    const presentCount = attendanceHistory.filter(a => a.isPresent).length;
    const absentCount = totalSessions - presentCount;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 50, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 25);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("ATTENDANCE TRACKING REPORT", 16, 33);

    // --- Rate Badge ---
    doc.setFillColor(attendanceRate >= 80 ? 16 : attendanceRate >= 50 ? 245 : 239, attendanceRate >= 80 ? 185 : 158, attendanceRate >= 80 ? 129 : 68);
    doc.roundedRect(150, 15, 45, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ATTENDANCE RATE", 155, 23);
    doc.setFontSize(16);
    doc.text(`${attendanceRate}%`, 155, 34);

    // --- Entity Info Section ---
    let currentY = 65;
    
    // Student Info (Left)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("STUDENT PROFILE", 15, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(student.name?.toUpperCase() || "STUDENT", 15, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${student.studentId || "STD-XXX"}`, 15, currentY + 11);
    doc.text(`Grade: ${student.grade || "Standard"}`, 15, currentY + 16);

    // Summary Info (Right)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("REPORT SUMMARY", 135, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`${totalSessions} Total Sessions`, 135, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Present: ${presentCount} | Absent: ${absentCount}`, 135, currentY + 11);
    doc.text(`Generated: ${generationDate}`, 135, currentY + 16);

    // --- Items List ---
    currentY += 30;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("ATTENDANCE LOG", 15, currentY);

    const bodyData = attendanceHistory.map((att) => [
      formatDate(att.date),
      formatTime(att.startTime),
      `${att.className || "---"} • ${att.subject || "---"}`,
      att.teacherName || "---",
      {
        content: att.isPresent ? "PRESENT" : "ABSENT",
        styles: { textColor: att.isPresent ? [16, 185, 129] : [239, 68, 68] },
      },
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Date", "Time", "Class & Subject", "Instructor", "Status"]],
      body: bodyData as any,
      theme: "grid",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 25 },
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "left" },
        3: { halign: "left" },
        4: { halign: "right", fontStyle: "bold" },
      },
      styles: { fontSize: 8, cellPadding: 6, lineColor: [241, 245, 249] },
    });

    // --- Footer Credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Official Attendance Report`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Attendance Records", 205, 290, { align: "right" });
    }

    // --- Save File ---
    const filename = `Attendance_${student.name?.split(' ')[0]}_${generationDate.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("PDF Generation Error:", error);
  }
};

export const generateGlobalAttendanceReportPDF = async (
  records: any[],
  className: string | null = null,
  monthFilter: string | null = null
) => {
  if (!records || records.length === 0) return;

  try {
    const doc = new jsPDF();
    const secondaryColor = [30, 41, 59];
    const mutedColor = [148, 163, 184];
    const generationDate = formatDate(new Date());

    // Calculate Stats
    const totalSessions = records.length;
    const totalPresent = records.reduce((acc, r) => acc + r.totalPresent, 0);
    const totalAbsent = records.reduce((acc, r) => acc + r.totalAbsent, 0);
    const totalHeadcount = totalPresent + totalAbsent;
    const attendanceRate = totalHeadcount > 0 ? Math.round((totalPresent / totalHeadcount) * 100) : 0;

    // --- Elegant Header Background ---
    doc.setFillColor(30, 41, 59); // Dark Slate
    doc.rect(0, 0, 210, 50, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 25);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("GLOBAL ATTENDANCE LEDGER", 16, 33);

    // --- Rate Badge ---
    doc.setFillColor(attendanceRate >= 80 ? 16 : attendanceRate >= 50 ? 245 : 239, attendanceRate >= 80 ? 185 : 158, attendanceRate >= 80 ? 129 : 68);
    doc.roundedRect(150, 15, 45, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("OVERALL PRESENCE", 153, 23);
    doc.setFontSize(16);
    doc.text(`${attendanceRate}%`, 155, 34);

    // --- Entity Info Section ---
    let currentY = 65;
    
    // Filters Info (Left)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("FILTER CRITERIA", 15, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(className ? className.toUpperCase() : "ALL ACADEMIC UNITS", 15, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Month: ${monthFilter || "All Time"}`, 15, currentY + 11);

    // Summary Info (Right)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("REPORT SUMMARY", 135, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`${totalSessions} Total Sessions`, 135, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Present: ${totalPresent} | Absent: ${totalAbsent}`, 135, currentY + 11);
    doc.text(`Generated: ${generationDate}`, 135, currentY + 16);

    // --- Items List ---
    currentY += 30;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("SESSION ARCHIVE", 15, currentY);

    const bodyData = records.map((att) => [
      formatDate(att.date),
      att.className || "---",
      att.teacherName || "---",
      `${att.totalPresent} Present, ${att.totalAbsent} Absent`,
      `${Math.round((att.totalPresent / (att.totalPresent + att.totalAbsent)) * 100) || 0}%`,
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Date", "Class", "Instructor", "Headcount", "Rate"]],
      body: bodyData as any,
      theme: "grid",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
        halign: "left",
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 35 },
        4: { halign: "right", fontStyle: "bold" },
      },
      styles: { fontSize: 8, cellPadding: 5, lineColor: [241, 245, 249] },
    });

    // --- Footer Credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Official Attendance Ledger`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Global Ledger", 205, 290, { align: "right" });
    }

    // --- Save File ---
    const filename = `Attendance_Ledger_${generationDate.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("PDF Generation Error:", error);
  }
};

export const generateSingleAttendanceSessionPDF = async (
  record: any
) => {
  if (!record) return;

  try {
    const doc = new jsPDF();
    const secondaryColor = [30, 41, 59];
    const mutedColor = [148, 163, 184];
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 50, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 25);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("SESSION ATTENDANCE VOUCHER", 16, 33);

    // --- Stats Badge ---
    const attendanceRate = Math.round((record.totalPresent / (record.totalPresent + record.totalAbsent)) * 100);
    doc.setFillColor(attendanceRate >= 80 ? 16 : 239, attendanceRate >= 80 ? 185 : 68, attendanceRate >= 80 ? 129 : 68);
    doc.roundedRect(150, 15, 45, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("SESSION RATE", 155, 23);
    doc.setFontSize(16);
    doc.text(`${attendanceRate}%`, 155, 34);

    // --- Entity Info Section ---
    let currentY = 65;
    
    // Session Info (Left)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("SESSION IDENTITY", 15, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(record.className?.toUpperCase() || "ACADEMIC UNIT", 15, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Grade: ${record.grade || "N/A"}`, 15, currentY + 11);
    doc.text(`Instructor: ${record.teacherName || "N/A"}`, 15, currentY + 16);

    // Date Info (Right)
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("AUDIT TIMESTAMP", 135, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(record.date || "N/A", 135, currentY + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Present: ${record.totalPresent}`, 135, currentY + 11);
    doc.text(`Absent: ${record.totalAbsent}`, 135, currentY + 16);

    // --- Student List ---
    currentY += 30;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT ATTENDANCE LIST", 15, currentY);

    const bodyData = record.records.map((r: any) => [
      r.studentName || "---",
      {
        content: r.isPresent ? "PRESENT" : "ABSENT",
        styles: { textColor: r.isPresent ? [16, 185, 129] : [239, 68, 68] },
      },
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Student Name", "Status"]],
      body: bodyData as any,
      theme: "grid",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
        halign: "left",
      },
      styles: { fontSize: 8, cellPadding: 4, lineColor: [241, 245, 249] },
      columnStyles: {
        1: { halign: "right", fontStyle: "bold" },
      },
    });

    // --- Footer Credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Session Voucher`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Session Voucher", 205, 290, { align: "right" });
    }

    // --- Save File ---
    const filename = `Session_${record.className.replace(/\s+/g, '_')}_${record.date}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("PDF Generation Error:", error);
  }
};

export const generateMonthlyFinanceReportPDF = async (
  income: any[],
  expenses: any[],
  stats: {
    incomeTotal: number;
    expenseTotal: number;
    netProfit: number;
    pendingIncome: number;
    pendingExpense: number;
  },
  month: string,
) => {
  try {
    const doc = new jsPDF();
    const primaryColor = [29, 158, 117]; // Emerald 600
    const incomeColor = [16, 185, 129]; // Emerald 600
    const expenseColor = [244, 63, 94]; // Rose 500
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 45, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 22);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`INSTITUTIONAL FINANCIAL AUDIT • CYCLE: ${formatMonthYear(month).toUpperCase()}`, 15, 30);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 22);
    doc.text(`REF: FIN-${month.replace("-", "")}`, 160, 28);

    // --- Summary Stats Section ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(15, 55, 55, 30, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("GROSS REVENUE", 22, 65);
    doc.setFontSize(12);
    doc.text(`LKR ${stats.incomeTotal.toLocaleString()}`, 22, 75);

    doc.setFillColor(expenseColor[0], expenseColor[1], expenseColor[2]);
    doc.roundedRect(77, 55, 55, 30, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("TOTAL DISBURSEMENTS", 84, 65);
    doc.setFontSize(12);
    doc.text(`LKR ${stats.expenseTotal.toLocaleString()}`, 84, 75);

    doc.setFillColor(incomeColor[0], incomeColor[1], incomeColor[2]);
    doc.roundedRect(139, 55, 55, 30, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("NET FISCAL PROFIT", 146, 65);
    doc.setFontSize(12);
    doc.text(`LKR ${stats.netProfit.toLocaleString()}`, 146, 75);

    // --- Risk Summary ---
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 95, 179, 15, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("LIABILITY ANALYSIS:", 22, 104);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Arrears Risk: LKR ${stats.pendingIncome.toLocaleString()}  |  Unpaid Payroll: LKR ${stats.pendingExpense.toLocaleString()}`,
      55,
      104,
    );

    // --- Income Table ---
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("REVENUE FLOW (COLLECTED FEES)", 15, 125);

    autoTable(doc, {
      startY: 130,
      head: [["Ref Code", "Student Identity", "Channel", "Approval Date", "Value"]],
      body: income.length > 0 ? income.map((p) => [
        p.id.slice(-8).toUpperCase(),
        p.studentName,
        p.method.toUpperCase(),
        p.createdAt?.toDate ? formatDate(p.createdAt.toDate()) : "---",
        { content: `LKR ${p.amount.toLocaleString()}`, styles: { halign: "right" } },
      ]) : [["---", "No fiscal records", "---", "---", "0.00"]],
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 4, lineColor: [241, 245, 249] },
      columnStyles: { 4: { fontStyle: "bold" } },
    });

    // --- Expense Table ---
    let nextY = (doc as any).lastAutoTable.finalY + 15;
    if (nextY > 240) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("OPERATIONAL OUTFLOW (TEACHER PAYROLL)", 15, nextY);

    autoTable(doc, {
      startY: nextY + 5,
      head: [["Invoice Ref", "Faculty Member", "Class Designation", "Sessions", "Value"]],
      body: expenses.length > 0 ? expenses.map((s) => [
        s.id.slice(-8).toUpperCase(),
        s.teacherName,
        s.className || "General",
        s.sessionsConducted,
        { content: `LKR ${s.netAmount.toLocaleString()}`, styles: { halign: "right" } },
      ]) : [["---", "No payroll records", "---", "---", "0.00"]],
      theme: "grid",
      headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 4, lineColor: [241, 245, 249] },
      columnStyles: { 4: { fontStyle: "bold" } },
    });

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Institutional Audit • Page ${i} of ${pageCount} • Fiscal Authority Terminal`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Finance Division", 205, 290, { align: "right" });
    }

    doc.save(`Financial_Audit_${month}.pdf`);
  } catch (error) {
    console.error("Finance PDF Error:", error);
  }
};

export const generateStudentIDCardPDF = async (
  student: any,
  qrCodeData: string,
) => {
  if (!student) return;

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [86, 54],
    });

    const primaryColor = [16, 185, 129]; // Emerald 600
    const slateColor = [30, 41, 59]; // Slate 800

    // --- Background Design ---
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 86, 54, "F");

    // Aesthetic side bar (Left Branding)
    doc.setFillColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.rect(0, 0, 4, 54, "F");
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(4, 0, 1, 54, "F");

    // Header strip
    doc.setFillColor(248, 250, 252);
    doc.rect(5, 0, 81, 14, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.text("SMART ACADEMY", 8, 7);

    doc.setFontSize(5);
    doc.setTextColor(100, 116, 139);
    doc.text("PREMIUM INSTITUTIONAL IDENTITY", 8, 10);

    // --- QR Code Placement ---
    if (qrCodeData) {
      doc.setDrawColor(241, 245, 249);
      doc.rect(60, 18, 20, 20); // Border for QR
      doc.addImage(qrCodeData, "PNG", 61, 19, 18, 18);
    }

    // --- Student Details ---
    doc.setFontSize(6);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT IDENTITY CARD", 8, 19);

    doc.setFontSize(11);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(student.name.toUpperCase(), 8, 26);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(`ID: ${student.studentId || "STD-XXX"}`, 8, 31);

    // Meta grid
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184);
    doc.text("GRADE LEVEL", 8, 38);
    doc.text("ADMISSION YEAR", 35, 38);

    doc.setFontSize(7);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(student.grade || "N/A", 8, 43);
    doc.text("2026", 35, 43);

    // Footer contact
    doc.setFillColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.rect(5, 47, 81, 7, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5);
    doc.setFont("helvetica", "italic");
    doc.text("Verified Institutional Document", 8, 51.5);
    doc.setFont("helvetica", "bold");
    doc.text("SA ADMIN", 75, 51.5);

    doc.save(`IDCard_${student.name.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("ID Card Generation Error:", error);
  }
};

export const generateTeacherListPDF = async (
  teachers: any[],
  title: string,
  subtitle: string,
) => {
  if (!teachers || teachers.length === 0) return;

  try {
    const doc = new jsPDF();
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${title.toUpperCase()} • ${subtitle.toUpperCase()}`, 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`FACULTY COUNT: ${teachers.length}`, 160, 20);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 26);

    // --- Table ---
    const bodyData = teachers.map((t, idx) => {
      const subjects = t.subjects?.join(", ") || "Not Assigned";
      return [
        idx + 1,
        t.teacherId || "---",
        t.name,
        subjects,
        t.phone || "—",
        t.status.toUpperCase(),
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [["#", "Faculty ID", "Lead Instructor Name", "Departments/Subjects", "Primary Contact", "Duty Status"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [71, 85, 105],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "center", cellWidth: 25 },
        2: { fontStyle: "bold", cellWidth: 45 },
        5: { halign: "center" },
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Official Faculty Registry Archive`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Faculty Records", 205, 290, { align: "right" });
    }

    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Teacher List PDF Generation Error:", error);
  }
};

export const generateGradeListPDF = async (
  grades: any[],
  title: string,
  subtitle: string,
) => {
  if (!grades || grades.length === 0) return;

  try {
    const doc = new jsPDF();
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${title.toUpperCase()} • ${subtitle.toUpperCase()}`, 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`LEVELS: ${grades.length}`, 160, 20);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 26);

    // --- Table ---
    const bodyData = grades.map((g, idx) => {
      return [
        idx + 1,
        g.name,
        g.studentCount || 0,
        g.classCount || 0,
        g.status.toUpperCase(),
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [["#", "Academic Grade Level", "Census (Students)", "Active Class Groups", "System Status"]],
      body: bodyData,
      theme: "striped",
      headStyles: {
        fillColor: [71, 85, 105],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { fontStyle: "bold", cellWidth: 50 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
      },
      styles: { fontSize: 8, cellPadding: 4 },
    });

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Grade Hierarchy Registry`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Grade Registry Archive", 205, 290, { align: "right" });
    }

    doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Grade List PDF Generation Error:", error);
  }
};

export const generateStudentPaymentHistoryPDF = async (
  payments: Payment[],
  student: Student,
) => {
  if (!student || !payments) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [29, 158, 117]; // Emerald 600
    const secondaryColor = [30, 41, 59]; // Slate 800
    const mutedColor = [148, 163, 184]; // Slate 400
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 45, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("STUDENT PAYMENT STATEMENT • SECURE FISCAL LEDGER", 15, 30);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`RECORDS: ${payments.length}`, 160, 20);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 26);

    // --- Student Info ---
    let currentY = 60;
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("STUDENT IDENTITY", 15, currentY);

    doc.setFontSize(14);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(student.name.toUpperCase(), 15, currentY + 8);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(`Registry ID: ${student.studentId || "PENDING"}`, 15, currentY + 15);
    doc.text(`Grade/Level: ${student.grade || "N/A"}`, 15, currentY + 21);

    // --- Financial Summary Card ---
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(135, 55, 60, 30, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("CUMULATIVE SETTLEMENT", 142, 65);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`LKR ${totalPaid.toLocaleString()}`, 142, 75);

    // --- Ledger Table ---
    autoTable(doc, {
      startY: 95,
      head: [["Transaction Date", "Billing Cycle", "Description", "Method", "Amount Settled"]],
      body: payments.map((p) => [
        formatDate(p.createdAt),
        p.month.toUpperCase(),
        p.subject || "Standard Fee",
        p.method?.toUpperCase() || "CASH",
        { content: `LKR ${p.amount?.toLocaleString()}`, styles: { fontStyle: "bold", halign: "right" } },
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 30 },
        1: { halign: "center", cellWidth: 35 },
        3: { halign: "center" },
        4: { halign: "right", cellWidth: 35 },
      },
      styles: { fontSize: 8, cellPadding: 5, lineColor: [241, 245, 249] },
    });

    // --- Page Footers with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Authentic Fiscal Statement`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Financial Statement Service", 205, 290, { align: "right" });
    }

    doc.save(`Financial_Statement_${student.name.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Payment History PDF Error:", error);
  }
};

export const generatePaymentsReportPDF = (
  payments: Payment[],
  title: string = "Payment Transaction Report",
) => {
  if (!payments || payments.length === 0) return;

  try {
    const doc = new jsPDF();
    const generationDate = formatDate(new Date());

    // --- Elegant Header Background ---
    doc.setFillColor(15, 23, 42); // Deep Slate
    doc.rect(0, 0, 210, 40, "F");

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(`${title.toUpperCase()} • COMPREHENSIVE FISCAL AUDIT LOG`, 15, 28);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`TOTAL ENTRIES: ${payments.length}`, 160, 20);
    doc.text(`AUDIT DATE: ${generationDate}`, 160, 26);

    // --- Table ---
    const bodyData = payments.map((p, idx) => {
      const type = p.subject === "Admission" ? "Admission" : "Monthly";
      const details = p.subjects?.join(", ") || p.subject || "---";
      
      return [
        idx + 1,
        p.id.slice(0, 8).toUpperCase(),
        p.studentName,
        `${type}: ${details}`,
        formatPaymentMonth(p.month),
        p.method.toUpperCase(),
        { content: `LKR ${p.amount?.toLocaleString()}`, styles: { fontStyle: "bold", halign: "right" } },
      ];
    });

    autoTable(doc, {
      startY: 50,
      head: [["#", "Ref ID", "Student Identity", "Description", "Cycle", "Channel", "Amount Settled"]],
      body: bodyData as any,
      theme: "striped",
      headStyles: {
        fillColor: [29, 158, 117],
        fontSize: 7,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "center", cellWidth: 18 },
        2: { fontStyle: "bold", cellWidth: 35 },
        3: { fontSize: 6.5 },
        4: { halign: "center", cellWidth: 25 },
        5: { halign: "center", cellWidth: 18 },
        6: { halign: "right", cellWidth: 25 },
      },
      styles: { fontSize: 7.5, cellPadding: 3 },
    });

    // --- Footer with credits ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 282, 210, 15, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text(`Page ${i} of ${pageCount} • Consolidated Financial Transaction Report`, 15, 290);
        
        doc.setFont("helvetica", "normal");
        doc.text("SmartAcademy Institutional Portal • Transaction Audit System", 205, 290, { align: "right" });
    }

    doc.save(`Transaction_Report_${generationDate.replace(/\s+/g, "_")}.pdf`);
  } catch (error) {
    console.error("Payments Report PDF Generation Error:", error);
  }
};
