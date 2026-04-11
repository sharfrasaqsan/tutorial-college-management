import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Salary } from '@/types/models';
import { formatMonthYear, formatDate, formatTime } from './formatters';

export const generateSalaryPDF = async (salary: Salary) => {
  if (!salary) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [79, 70, 229]; // Institutional Indigo
    const secondaryColor = [30, 41, 59]; // Slate 800

    // Fetch linked sessions for detailed log
    let sessionLogs: any[] = [];
    try {
        const completionsQ = query(
            collection(db, "session_completions"),
            where("salaryId", "==", salary.id),
            orderBy("date", "asc"),
            orderBy("startTime", "asc")
        );
        const completionsSnap = await getDocs(completionsQ);
        sessionLogs = completionsSnap.docs.map(d => d.data());
    } catch (e) {
        console.warn("Could not fetch session logs for PDF", e);
    }

    // Safely extract values
    const teacherName = (salary.teacherName || "Faculty Member").toUpperCase();
    const teacherId = salary.teacherId ? `FAC-0${salary.teacherId.slice(-3)}` : "FAC-XXX";
    const className = salary.className || "Standard Academic Session";
    const netAmount = salary.netAmount || 0;
    const sessionsConducted = salary.sessionsConducted || sessionLogs.length || 0; // Use logs as fallback
    const sessionsPerCycle = salary.sessionsPerCycle || 8;
    const perSessionRate = salary.perSessionRate || 0;
    const studentCount = salary.studentCount || 0;
    const monthlyFee = salary.monthlyFee || 0;
    const payrollCycle = formatMonthYear(salary.month);
    const invoiceId = salary.id ? salary.id.slice(-8).toUpperCase() : "TEMP";

    // --- Dynamic Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("ANTIGRAVITY ACADEMY", 15, 22);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("INSTITUTIONAL PAYROLL TERMINAL • OFFICIAL SETTLEMENT ADVICE", 15, 32);

    // --- Invoice Metadata ---
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`REFERENCE: #INV-SLY-${invoiceId}`, 140, 20);
    doc.text(`ISSUED ON: ${formatDate(salary.createdAt)}`, 140, 26);
    doc.text(`STATUS: AUTHORIZED`, 140, 32);

    // --- Recipient Information ---
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("SETTLEMENT RECIPIENT", 15, 60);

    doc.setFontSize(14);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(teacherName, 15, 70);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Faculty ID: ${teacherId}`, 15, 77);
    doc.text(`Payroll Cycle: ${payrollCycle}`, 15, 83);

    // --- Financial Summary Card ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(135, 55, 60, 35, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("TOTAL NET PAYABLE", 142, 65);
    doc.setFontSize(18);
    doc.text(`LKR ${netAmount.toLocaleString()}`, 142, 78);

    // --- Class Completion Details ---
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("ACADEMIC COMPLETION SUMMARY", 15, 100);

    autoTable(doc, {
      startY: 105,
      head: [['Academic Unit', 'Attendance/Sessions', 'Enrollment', 'Cycle Benchmark']],
      body: [[
        { content: className, styles: { fontStyle: 'bold' } },
        `${sessionsConducted} Sessions Held`,
        `${studentCount} Students`,
        `${sessionsPerCycle} Sessions`
      ]],
      theme: 'grid',
      headStyles: { 
        fillColor: [248, 250, 252], 
        textColor: [100, 116, 139],
        fontSize: 7, 
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 70 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 5, lineColor: [241, 245, 249] }
    });

    // --- Detailed Session Logs ---
    if (sessionLogs.length > 0) {
        const logsY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text("VERIFIED SESSION LOGS", 15, logsY);

        autoTable(doc, {
            startY: logsY + 5,
            head: [['Date', 'Start Time', 'Subject/Grade', 'Verification Status']],
            body: sessionLogs.map(log => [
                log.date,
                formatTime(log.startTime),
                `${log.subject} (Grade ${log.grade})`,
                "LOGGED & PAID"
            ]),
            theme: 'striped',
            headStyles: { fillColor: [203, 213, 225], textColor: [30, 41, 59], fontSize: 7 },
            styles: { fontSize: 7, cellPadding: 3 }
        });
    }

    // --- Financial Ledger ---
    const ledgerY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("FINANCIAL SETTLEMENT LEDGER", 15, ledgerY);

    autoTable(doc, {
      startY: ledgerY + 5,
      head: [['Description', 'Unit Value', 'Performance Multiplier', 'Settlement']],
      body: [[
        "Faculty Class Settlement",
        `LKR ${perSessionRate.toLocaleString(undefined, { minimumFractionDigits: 2 })} / Session`,
        `${sessionsConducted} Sessions`,
        { content: `LKR ${netAmount.toLocaleString()}`, styles: { fontStyle: 'bold', textColor: primaryColor as [number, number, number] } }
      ]],
      theme: 'striped',
      headStyles: { 
        fillColor: [30, 41, 59], 
        fontSize: 8, 
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 70 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' }
      },
      styles: { fontSize: 8, cellPadding: 6 }
    });

    // --- Footer ---
    const finalY = Math.min(270, (doc as any).lastAutoTable.finalY + 30);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("This document is a digital settlement advice authorized by the Antigravity Academy Finance Department.", 105, finalY + 10, { align: 'center' });
    doc.text("It is computer-generated and serves as an official proof of disbursement.", 105, finalY + 14, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240);
    doc.line(15, finalY - 5, 75, finalY - 5);
    doc.text("AUTHORIZED SIGNATURE", 15, finalY);

    // --- Save File ---
    const filename = `Invoice_${className.replace(/\s+/g, '_')}_${salary.month}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Critical PDF Generation Error:", error);
  }
};
