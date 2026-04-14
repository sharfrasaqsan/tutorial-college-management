import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Salary, Payment } from '@/types/models';
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
            where("salaryId", "==", salary.id)
        );
        const completionsSnap = await getDocs(completionsQ);
        sessionLogs = completionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
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
    doc.text("SMART ACADEMY", 15, 22);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("TEACHER PAYMENT RECEIPT", 15, 32);

    // --- Invoice Metadata ---
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`ID: #SLY-${invoiceId}`, 140, 20);
    doc.text(`DATE: ${formatDate(salary.createdAt)}`, 140, 26);
    doc.text(`STATUS: ${salary.status.toUpperCase()}`, 140, 32);

    // --- Teacher Information ---
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("TEACHER INFO", 15, 60);

    doc.setFontSize(14);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(teacherName, 15, 70);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Teacher ID: ${teacherId}`, 15, 77);
    doc.text(`Month: ${payrollCycle}`, 15, 83);

    // --- Payment Summary Card ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(135, 55, 60, 35, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("TOTAL SALARY", 142, 65);
    doc.setFontSize(18);
    doc.text(`LKR ${netAmount.toLocaleString()}`, 142, 78);

    // --- Class Summary ---
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("CLASS SUMMARY", 15, 100);

    autoTable(doc, {
      startY: 105,
      head: [['Class Name', 'Done', 'Students', 'Goal']],
      body: [[
        { content: className, styles: { fontStyle: 'bold' } },
        `${sessionsConducted} Classes`,
        `${studentCount} Students`,
        `${sessionsPerCycle} Total`
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

    // --- Session Completed Details (Detailed Table) ---
    const detailY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT DETAILS", 15, detailY);

    const bodyData = sessionLogs.length > 0 
        ? sessionLogs.map(log => {
            const timeRange = log.endTime && log.endTime !== "--:--" 
                ? `${formatTime(log.startTime)} - ${formatTime(log.endTime)}` 
                : formatTime(log.startTime);

            return [
                log.date,
                timeRange,
                `${log.grade || '---'} • ${log.subject || '---'}`,
                `${log.studentCount || studentCount}`,
                `${perSessionRate.toLocaleString()}`,
                `${perSessionRate.toLocaleString()}`
            ];
          })
        : [[
            "---", 
            "---", 
            `${className}`, 
            `${studentCount}`,
            `${perSessionRate.toLocaleString()}`, 
            `${netAmount.toLocaleString()}`
          ]];

    autoTable(doc, {
      startY: detailY + 5,
      head: [['Date', 'Time', 'Class', 'Students', 'Rate', 'Amount']],
      body: bodyData,
      theme: 'striped',
      headStyles: { 
        fillColor: [30, 41, 59], 
        fontSize: 7, 
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 25 },
        1: { halign: 'center', cellWidth: 35 },
        2: { halign: 'left' },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 25 }
      },
      styles: { fontSize: 7, cellPadding: 4 }
    });

    // --- Footer ---
    const finalY = Math.min(270, (doc as any).lastAutoTable.finalY + 30);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("This receipt is issued as proof of payment to the teacher.", 105, finalY + 10, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240);
    doc.line(15, finalY - 5, 75, finalY - 5);
    doc.text("SIGNATURE", 15, finalY);

    // --- Save File ---
    const filename = `Invoice_${className.replace(/\s+/g, '_')}_${salary.month}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Critical PDF Generation Error:", error);
  }
};

export const generateStudentPaymentPDF = async (payment: Payment, studentName?: string, studentId?: string) => {
  if (!payment) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [16, 185, 129]; // Emerald 600 (for income)
    const secondaryColor = [30, 41, 59]; // Slate 800

    // Metadata
    const invoiceId = payment.id ? payment.id.slice(-8).toUpperCase() : "TEMP";
    const receiptDate = formatDate(payment.createdAt || new Date());
    const monthName = payment.month.charAt(0).toUpperCase() + payment.month.slice(1);

    // --- Dynamic Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 15, 22);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("STUDENT FEE RECEIPT", 15, 32);

    // --- Receipt Metadata ---
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`ID: #PAY-${invoiceId}`, 140, 20);
    doc.text(`DATE: ${receiptDate}`, 140, 26);
    doc.text(`METHOD: ${payment.method.toUpperCase()}`, 140, 32);

    // --- Student Information ---
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("STUDENT INFO", 15, 60);

    doc.setFontSize(14);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(studentName?.toUpperCase() || "STUDENT", 15, 70);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Student ID: ${studentId || "STD-XXX"}`, 15, 77);
    doc.text(`For Month: ${monthName} 2026`, 15, 83);

    // --- Amount Card ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(135, 55, 60, 35, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text("PAID AMOUNT", 142, 65);
    doc.setFontSize(18);
    doc.text(`LKR ${payment.amount.toLocaleString()}`, 142, 78);

    // --- Payment Details Table ---
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT INFO", 15, 100);

    const bodyData = payment.items && payment.items.length > 0 
        ? payment.items.map((item: any) => [
            { content: `${item.subject || '---'} • ${item.name || '---'}`, styles: { fontStyle: 'bold' } },
            monthName,
            item.amount.toLocaleString()
          ])
        : [[
            { content: `${payment.subject || '---'} • Monthly Fee`, styles: { fontStyle: 'bold' } },
            monthName,
            payment.amount.toLocaleString()
          ]];

    autoTable(doc, {
      startY: 105,
      head: [['Description', 'Month', 'Amount']],
      body: bodyData,
      theme: 'grid',
      headStyles: { 
        fillColor: [248, 250, 252], 
        textColor: [100, 116, 139],
        fontSize: 8, 
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 5
      },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center', cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      styles: { fontSize: 9, cellPadding: 6, lineColor: [241, 245, 249] }
    });

    // --- Note ---
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "italic");
    doc.text("Thank you for your payment. Please keep this receipt safely.", 15, finalY);

    // --- Footer ---
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("This is a system-generated receipt.", 105, 280, { align: 'center' });
    
    // --- Save File ---
    const filename = `Receipt_${studentName?.replace(/\s+/g, '_') || 'Student'}_${monthName}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("PDF Generation Error:", error);
  }
};

export const generateStudentListPDF = async (students: any[], title: string, subtitle: string) => {
  if (!students || students.length === 0) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [30, 41, 59]; // Slate 800
    
    // --- Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), 15, 28);
    doc.text(subtitle, 15, 34);

    doc.setFontSize(8);
    doc.text(`Date: ${formatDate(new Date())}`, 160, 20);
    doc.text(`Students: ${students.length}`, 160, 26);

    // --- Table ---
    const bodyData = students.map((s, idx) => [
        idx + 1,
        s.studentId || "---",
        s.name,
        s.parentName || "—",
        s.phone || s.parentPhone || "—",
        s.schoolName || "—"
    ]);

    autoTable(doc, {
        startY: 50,
        head: [['#', 'ID', 'Student Name', 'Parent Name', 'Mobile', 'School']],
        body: bodyData,
        theme: 'striped',
        headStyles: { 
            fillColor: [30, 41, 59], 
            fontSize: 8, 
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'center', cellWidth: 25 },
            2: { fontStyle: 'bold', cellWidth: 45 },
            3: { cellWidth: 35 },
            4: { halign: 'center', cellWidth: 30 },
            5: { cellWidth: 45 }
        },
        styles: { fontSize: 8, cellPadding: 4 }
    });

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount} • Smart Academy Student Report`, 105, 290, { align: 'center' });
    }

    doc.save(`${title.replace(/\s+/g, '_')}_List.pdf`);
  } catch (error) {
    console.error("List PDF Generation Error:", error);
  }
};

export const generateClassListPDF = async (classes: any[], title: string, subtitle: string) => {
  if (!classes || classes.length === 0) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [30, 41, 59]; // Slate 800
    
    // --- Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), 15, 28);
    doc.text(subtitle, 15, 34);

    doc.setFontSize(8);
    doc.text(`Date: ${formatDate(new Date())}`, 160, 20);
    doc.text(`Classes: ${classes.length}`, 160, 26);

    // --- Table ---
    const bodyData = classes.map((c, idx) => {
        const schedules = (c.schedules || []).map((s: any) => 
            `${s.dayOfWeek.slice(0,3).toUpperCase()} (${formatTime(s.startTime)})`
        ).join(', ');

        return [
            idx + 1,
            c.name,
            c.subject || "—",
            c.teacherName || "—",
            c.studentCount || 0,
            schedules || "---"
        ];
    });

    autoTable(doc, {
        startY: 50,
        head: [['#', 'Class Name', 'Subject', 'Teacher', 'Students', 'Day & Time']],
        body: bodyData,
        theme: 'striped',
        headStyles: { 
            fillColor: [30, 41, 59], 
            fontSize: 8, 
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { fontStyle: 'bold', cellWidth: 40 },
            2: { cellWidth: 35 },
            3: { cellWidth: 40 },
            4: { halign: 'center', cellWidth: 20 },
            5: { fontSize: 7 }
        },
        styles: { fontSize: 8, cellPadding: 4 }
    });

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount} • Smart Academy Class Report`, 105, 290, { align: 'center' });
    }

    doc.save(`${title.replace(/\s+/g, '_')}_Registry.pdf`);
  } catch (error) {
    console.error("Class List PDF Generation Error:", error);
  }
};

export const generateMasterRosterPDF = async (students: any[], grades: any[], classes: any[]) => {
  if (!students || students.length === 0) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [30, 41, 59]; // Slate 800
    
    // --- Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("MASTER STUDENT ROSTER", 15, 28);
    doc.text("Complete Institutional Enrollment Directory", 15, 34);

    doc.setFontSize(8);
    doc.text(`Date: ${formatDate(new Date())}`, 160, 20);
    doc.text(`Total Students: ${students.length}`, 160, 26);

    let currentY = 50;

    // Sort grades
    const sortedGrades = [...grades].sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    for (const grade of sortedGrades) {
        const gradeClasses = classes.filter(c => c.gradeId === grade.id);
        
        if (gradeClasses.length === 0) continue;

        // Check if we need a new page for the grade header
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(grade.name.toUpperCase(), 15, currentY);
        currentY += 5;
        doc.setDrawColor(241, 245, 249);
        doc.line(15, currentY, 195, currentY);
        currentY += 10;

        for (const cls of gradeClasses) {
            const classStudents = students.filter(s => s.enrolledClasses?.includes(cls.id));
            
            if (classStudents.length === 0) continue;

            // Header for Class
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text(`${cls.name} (${cls.subject || 'General'}) • ${classStudents.length} Students`, 15, currentY);
            currentY += 4;

            autoTable(doc, {
                startY: currentY,
                head: [['#', 'ID', 'Student Name', 'Parent Mobile', 'Status']],
                body: classStudents.map((s, idx) => [
                    idx + 1,
                    s.studentId || "---",
                    s.name,
                    s.phone || s.parentPhone || "---",
                    s.status.toUpperCase()
                ]),
                theme: 'striped',
                headStyles: { 
                    fillColor: [71, 85, 105], 
                    fontSize: 7, 
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 10 },
                    1: { halign: 'center', cellWidth: 25 },
                    2: { fontStyle: 'bold' },
                    3: { halign: 'center', cellWidth: 35 },
                    4: { halign: 'center', cellWidth: 25 }
                },
                styles: { fontSize: 8, cellPadding: 3 },
                margin: { left: 15, right: 15 }
            });

            currentY = (doc as any).lastAutoTable.finalY + 15;

            // Check if room for next class
            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }
        }
    }

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount} • ${formatDate(new Date())} • Official Smart Academy Master List`, 105, 290, { align: 'center' });
    }

    doc.save(`Master_Roster_${formatDate(new Date()).replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("Master Roster PDF Error:", error);
  }
};

export const generateMasterClassRegistryPDF = async (classes: any[], grades: any[]) => {
  if (!classes || classes.length === 0) return;

  try {
    const doc = new jsPDF();
    const primaryColor = [30, 41, 59]; // Slate 800
    
    // --- Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 15, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("MASTER CLASS REGISTRY", 15, 28);
    doc.text("Complete Institutional Academic Schedule", 15, 34);

    doc.setFontSize(8);
    doc.text(`Date: ${formatDate(new Date())}`, 160, 20);
    doc.text(`Total Classes: ${classes.length}`, 160, 26);

    let currentY = 50;

    // Sort grades
    const sortedGrades = [...grades].sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    for (const grade of sortedGrades) {
        const gradeClasses = classes.filter(c => c.gradeId === grade.id);
        
        if (gradeClasses.length === 0) continue;

        // Check page space
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(grade.name.toUpperCase(), 15, currentY);
        currentY += 5;
        doc.setDrawColor(241, 245, 249);
        doc.line(15, currentY, 195, currentY);
        currentY += 10;

        autoTable(doc, {
            startY: currentY,
            head: [['Class Name', 'Subject', 'Teacher', 'Students', 'Day & Time']],
            body: gradeClasses.map(c => {
                const schedules = (c.schedules || []).map((s: any) => 
                    `${s.dayOfWeek.slice(0,3).toUpperCase()} (${formatTime(s.startTime)})`
                ).join(', ');

                return [
                    c.name,
                    c.subject || "---",
                    c.teacherName || "---",
                    c.studentCount || 0,
                    schedules || "---"
                ];
            }),
            theme: 'striped',
            headStyles: { 
                fillColor: [30, 41, 59], 
                fontSize: 8, 
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 40 },
                1: { cellWidth: 30 },
                2: { cellWidth: 35 },
                3: { halign: 'center', cellWidth: 20 },
                4: { fontSize: 7 }
            },
            styles: { fontSize: 8, cellPadding: 4 },
            margin: { left: 15, right: 15 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount} • Official Smart Academy Class Registry`, 105, 290, { align: 'center' });
    }

    doc.save(`Master_Class_Registry_${formatDate(new Date()).replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("Master Class PDF Error:", error);
  }
};

export const generateMonthlyFinanceReportPDF = async (
    income: any[], 
    expenses: any[], 
    stats: { 
        incomeTotal: number, 
        expenseTotal: number, 
        netProfit: number,
        pendingIncome: number,
        pendingExpense: number
    }, 
    month: string
) => {
  try {
    const doc = new jsPDF();
    const primaryColor = [79, 70, 229]; // Indigo 600
    const incomeColor = [16, 185, 129]; // Emerald 600
    const expenseColor = [244, 63, 94]; // Rose 500
    const slateColor = [30, 41, 59]; // Slate 800
    
    // --- Header ---
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 45, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 15, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text("INSTITUTIONAL FINANCIAL AUDIT", 15, 32);
    doc.text(`FISCAL CYCLE: ${formatMonthYear(month).toUpperCase()}`, 15, 38);

    doc.setFontSize(8);
    doc.text(`Generated: ${formatDate(new Date())}`, 160, 22);
    doc.text(`Reference: FIN-${month.replace('-', '')}`, 160, 28);

    // --- Summary Stats Section ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.roundedRect(15, 55, 55, 30, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("TOTAL REVENUE", 22, 65);
    doc.setFontSize(12);
    doc.text(`LKR ${stats.incomeTotal.toLocaleString()}`, 22, 75);

    doc.setFillColor(expenseColor[0], expenseColor[1], expenseColor[2]);
    doc.roundedRect(77, 55, 55, 30, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("TOTAL EXPENSES", 84, 65);
    doc.setFontSize(12);
    doc.text(`LKR ${stats.expenseTotal.toLocaleString()}`, 84, 75);

    doc.setFillColor(incomeColor[0], incomeColor[1], incomeColor[2]);
    doc.roundedRect(139, 55, 55, 30, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text("NET PROFIT", 146, 65);
    doc.setFontSize(12);
    doc.text(`LKR ${stats.netProfit.toLocaleString()}`, 146, 75);

    // --- Arrears / Obligations Notice ---
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 95, 179, 15, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("FISCAL RISK SUMMARY:", 22, 104);
    doc.setFont("helvetica", "normal");
    doc.text(`Pending Arrears: LKR ${stats.pendingIncome.toLocaleString()}  |  Outstanding Obligations: LKR ${stats.pendingExpense.toLocaleString()}`, 58, 104);

    // --- Income Table ---
    doc.setFontSize(11);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("REVENUE FLOW (STUDENT FEES)", 15, 125);

    autoTable(doc, {
        startY: 130,
        head: [['Transaction Ref', 'Student Name', 'Method', 'Verified Date', 'Amount']],
        body: income.length > 0 ? income.map(p => [
            p.id.slice(-8).toUpperCase(),
            p.studentName,
            p.method.toUpperCase(),
            p.createdAt?.toDate ? formatDate(p.createdAt.toDate()) : '---',
            { content: p.amount.toLocaleString(), styles: { halign: 'right' } }
        ]) : [['---', 'No income records found for this period', '---', '---', '0.00']],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 4: { fontStyle: 'bold' } }
    });

    // --- Expense Table ---
    let nextY = (doc as any).lastAutoTable.finalY + 15;
    if (nextY > 240) { doc.addPage(); nextY = 20; }

    doc.setFontSize(11);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("OPERATIONAL EXPENSES (TEACHER PAYROLL)", 15, nextY);

    autoTable(doc, {
        startY: nextY + 5,
        head: [['Invoice Ref', 'Faculty Member', 'Class Group', 'Sessions', 'Amount']],
        body: expenses.length > 0 ? expenses.map(s => [
            s.id.slice(-8).toUpperCase(),
            s.teacherName,
            s.className || 'General',
            s.sessionsConducted,
            { content: s.netAmount.toLocaleString(), styles: { halign: 'right' } }
        ]) : [['---', 'No salary disbursements found for this period', '---', '---', '0.00']],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 4: { fontStyle: 'bold' } }
    });

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Institutional Audit • Page ${i} of ${pageCount} • Smart Academy Economy`, 105, 290, { align: 'center' });
    }

    doc.save(`Financial_Audit_${month}_${formatDate(new Date()).replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("Finance PDF Error:", error);
  }
};

export const generateStudentIDCardPDF = async (student: any, qrCodeData: string) => {
  if (!student) return;

  try {
    // Creating a landscape ID card (Standard CR80 size: 85.6mm x 53.98mm)
    // We'll use a slightly larger canvas for better resolution then scale if needed, 
    // but jsPDF uses points or mm. Let's use 86x54 mm.
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [86, 54]
    });

    const primaryColor = [16, 185, 129]; // Emerald 600
    const slateColor = [30, 41, 59]; // Slate 800

    // --- Background Design ---
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 86, 54, 'F');
    
    // Aesthetic side bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 3, 54, 'F');

    // Header strip
    doc.setFillColor(248, 250, 252);
    doc.rect(3, 0, 83, 12, 'F');

    // --- Institutional Branding ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("SMART ACADEMY", 6, 6);
    
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184);
    doc.text("OFFICIAL STUDENT IDENTIFICATION", 6, 9);

    // --- QR Code Placement ---
    if (qrCodeData) {
        doc.addImage(qrCodeData, 'PNG', 58, 14, 24, 24);
    }

    // --- Student Details ---
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text("STUDENT IDENTITY", 6, 18);

    doc.setFontSize(10);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(student.name.toUpperCase(), 6, 24);

    doc.setFontSize(6);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`ID: ${student.studentId || "STD-XXX"}`, 6, 28);

    // Grid for meta info
    doc.setFontSize(5);
    doc.setTextColor(148, 163, 184);
    doc.text("GRADE LEVEL", 6, 35);
    doc.text("ACADEMIC YEAR", 30, 35);

    doc.setFontSize(6);
    doc.setTextColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(student.grade || "N/A", 6, 39);
    doc.text("2026/2027", 30, 39);

    // Footer
    doc.setFillColor(slateColor[0], slateColor[1], slateColor[2]);
    doc.rect(3, 44, 83, 10, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text("This card remains the property of Smart Academy.", 6, 48);
    doc.text("Scan QR to verify enrollment status.", 6, 51);

    // Logo mark in footer
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("SA", 75, 50);

    doc.save(`IDCard_${student.name.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("ID Card Generation Error:", error);
  }
};
