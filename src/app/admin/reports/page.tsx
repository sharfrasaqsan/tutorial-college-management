"use client";

import { useState, useEffect, useMemo } from "react";
import { 
    FileText, 
    Users, 
    BookOpen, 
    GraduationCap, 
    Layers, 
    Wallet, 
    Clock, 
    Download, 
    Loader2, 
    Calendar as CalendarIcon,
    BarChart3,
    TrendingUp,
    ShieldCheck,
    Search,
    ChevronDown,
    Printer,
    UserCheck,
    CheckCircle2,
    CalendarDays,
    ArrowRight,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { collection, getDocs, query, orderBy, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import toast from "react-hot-toast";
import { 
    generateTeacherListPDF, 
    generateGradeListPDF, 
    generateMasterRosterPDF, 
    generateMasterClassRegistryPDF,
    generateMonthlyFinanceReportPDF,
    generateStudentListPDF,
    generateClassListPDF
} from "@/lib/pdf-generator";
import { format, subMonths, addMonths, setYear, setMonth, parse } from "date-fns";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    AreaChart, 
    Area,
    Legend
} from 'recharts';

type ReportTab = 'overview' | 'directories' | 'financials';

export default function ReportsHubPage() {
    const [activeTab, setActiveTab] = useState<ReportTab>('overview');
    const [exportingReport, setExportingReport] = useState<string | null>(null);
    const [financeDate, setFinanceDate] = useState(new Date());
    const [isFinanceMonthPickerOpen, setIsFinanceMonthPickerOpen] = useState(false);
    
    // Selection state for granular reports
    const [selectedGradeId, setSelectedGradeId] = useState("");
    const [selectedTeacherId, setSelectedTeacherId] = useState("");
    const [selectedClassId, setSelectedClassId] = useState("");
    const [studentSearchTerm, setStudentSearchTerm] = useState("");
    const [selectedStudentId, setSelectedStudentId] = useState("");
    
    // Lists for selectors
    const [grades, setGrades] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [allStudents, setAllStudents] = useState<any[]>([]);
    
    // Analytics Data State
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [chartData, setChartData] = useState<any[]>([]);
    const [summaries, setSummaries] = useState({
        totalStudents: 0,
        totalTeachers: 0,
        totalRevenue: 0,
        totalExpenses: 0
    });

    useEffect(() => {
        loadAnalytics();
        loadSelectorData();
    }, []);

    const loadSelectorData = async () => {
        try {
            const [gSnap, tSnap, cSnap, sSnap] = await Promise.all([
                getDocs(query(collection(db, "grades"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "teachers"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "classes"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "students"), orderBy("name", "asc")))
            ]);
            setGrades(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTeachers(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setClasses(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setAllStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        }
    };

    const loadAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            const monthsToFetch = 6;
            const now = new Date();
            const monthlyData: any[] = [];
            
            for (let i = monthsToFetch - 1; i >= 0; i--) {
                const targetDate = subMonths(now, i);
                const monthStr = format(targetDate, "yyyy-MM");
                const monthLabel = format(targetDate, "MMM yy");
                
                const payQ = query(collection(db, "payments"), where("month", "==", monthStr), where("status", "==", "paid"));
                const salQ = query(collection(db, "salaries"), where("month", "==", monthStr), where("status", "==", "paid"));
                
                const [paySnap, salSnap] = await Promise.all([getDocs(payQ), getDocs(salQ)]);
                
                let income = 0;
                paySnap.forEach(doc => income += (doc.data().amount || 0));
                
                let expense = 0;
                salSnap.forEach(doc => expense += (doc.data().netAmount || 0));
                
                monthlyData.push({ name: monthLabel, income, expense, profit: income - expense });
            }
            
            setChartData(monthlyData);
            
            const [stdSnap, teaSnap] = await Promise.all([
                getDocs(collection(db, "students")),
                getDocs(collection(db, "teachers"))
            ]);
            
            setSummaries({
                totalStudents: stdSnap.size,
                totalTeachers: teaSnap.size,
                totalRevenue: monthlyData.reduce((acc, curr) => acc + curr.income, 0),
                totalExpenses: monthlyData.reduce((acc, curr) => acc + curr.expense, 0)
            });

        } catch (error) {
            console.error("Error loading analytics:", error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const filteredStudents = useMemo(() => {
        if (!studentSearchTerm) return [];
        return allStudents.filter(s => 
            s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
            s.studentId?.toLowerCase().includes(studentSearchTerm.toLowerCase())
        ).slice(0, 5); // Limit to top 5 hits
    }, [studentSearchTerm, allStudents]);

    // Granular Export Handlers
    const handleGradeWiseExport = async () => {
        if (!selectedGradeId) return toast.error("Please select a grade level");
        const grade = grades.find(g => g.id === selectedGradeId);
        setExportingReport("grade-wise");
        try {
            const q = query(collection(db, "students"), where("gradeId", "==", selectedGradeId), orderBy("name", "asc"));
            const snap = await getDocs(q);
            const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await generateStudentListPDF(students, `Grade Enrollment: ${grade.name}`, `Institutional Roster for ${grade.name} Class Group`);
            toast.success("Grade enrollment list generated.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate granular report.");
        } finally {
            setExportingReport(null);
        }
    };

    const handleTeacherWiseExport = async () => {
        if (!selectedTeacherId) return toast.error("Please select a faculty member");
        const teacher = teachers.find(t => t.id === selectedTeacherId);
        setExportingReport("teacher-wise");
        try {
            const q = query(collection(db, "classes"), where("teacherId", "==", selectedTeacherId), orderBy("name", "asc"));
            const snap = await getDocs(q);
            const teacherClasses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await generateClassListPDF(teacherClasses, `Faculty Portfolio: ${teacher.name}`, `Complete instructional roster and timetable for ${teacher.name}`);
            toast.success("Teacher portfolio generated.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate report.");
        } finally {
            setExportingReport(null);
        }
    };

    const handleClassWiseExport = async () => {
        if (!selectedClassId) return toast.error("Please select an academic class");
        const cls = classes.find(c => c.id === selectedClassId);
        setExportingReport("class-wise");
        try {
            const q = query(collection(db, "students"), where("enrolledClasses", "array-contains", selectedClassId), orderBy("name", "asc"));
            const snap = await getDocs(q);
            const students = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await generateStudentListPDF(students, `Class Roster: ${cls.name}`, `${cls.subject} • ${cls.grade} Enrollment Directory`);
            toast.success("Class roster generated.");
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate report.");
        } finally {
            setExportingReport(null);
        }
    };

    const handleStudentSpecificExport = async (studentToExport?: any) => {
        const student = studentToExport || allStudents.find(s => s.id === selectedStudentId);
        if (!student) return toast.error("Please select or search for a student");
        
        setExportingReport("student-specific");
        try {
            await generateStudentListPDF([{id: student.id, ...student}], `Student Record: ${student.name}`, `Official Enrollment verification for ${student.studentId || student.id.slice(-6).toUpperCase()}`);
            toast.success("Individual student record generated.");
            setStudentSearchTerm("");
            setSelectedStudentId("");
        } catch (e) {
            console.error(e);
            toast.error("Process aborted.");
        } finally {
            setExportingReport(null);
        }
    };

    // Master Export Handlers (Existing)
    const handleTeacherExport = async () => {
        setExportingReport("teachers-master");
        try {
            const snap = await getDocs(query(collection(db, "teachers"), orderBy("name", "asc")));
            const t = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await generateTeacherListPDF(t, "Master Faculty Directory", "Complete Staff Overview");
            toast.success("Faculty directory exported.");
        } catch (e) { console.error(e); toast.error("Export failed."); } finally { setExportingReport(null); }
    };

    const handleGradesExport = async () => {
        setExportingReport("grades-master");
        try {
            const snap = await getDocs(query(collection(db, "grades"), orderBy("name", "asc")));
            const g = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await generateGradeListPDF(g, "Grade Level Architecture", "Institutional Academic Configuration");
            toast.success("Grade levels exported.");
        } catch (e) { console.error(e); toast.error("Export failed."); } finally { setExportingReport(null); }
    };

    const handleMasterRosterExport = async () => {
        setExportingReport("roster-master");
        try {
            const [sSnap, gSnap, cSnap] = await Promise.all([
                getDocs(query(collection(db, "students"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "grades"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "classes"), orderBy("name", "asc")))
            ]);
            await generateMasterRosterPDF(sSnap.docs.map(d=>({id:d.id,...d.data()})), gSnap.docs.map(d=>({id:d.id,...d.data()})), cSnap.docs.map(d=>({id:d.id,...d.data() })));
            toast.success("Master Roster exported.");
        } catch (e) { console.error(e); toast.error("Export failed."); } finally { setExportingReport(null); }
    };

    const handleMasterClassExport = async () => {
        setExportingReport("classes-master");
        try {
            const [cSnap, gSnap] = await Promise.all([
                getDocs(query(collection(db, "classes"), orderBy("name", "asc"))),
                getDocs(query(collection(db, "grades"), orderBy("name", "asc")))
            ]);
            await generateMasterClassRegistryPDF(cSnap.docs.map(d=>({id:d.id,...d.data()})), gSnap.docs.map(d=>({id:d.id,...d.data()})));
            toast.success("Master Class Registry exported.");
        } catch (e) { console.error(e); toast.error("Export failed."); } finally { setExportingReport(null); }
    };

    const handleFinanceExport = async () => {
        setExportingReport("finance");
        const financeMonth = format(financeDate, "yyyy-MM");
        try {
            const payQ = query(collection(db, "payments"), where("month", "==", financeMonth));
            const salQ = query(collection(db, "salaries"), where("month", "==", financeMonth));
            const [paySnap, salSnap] = await Promise.all([ getDocs(payQ), getDocs(salQ) ]);
            let incomeTotal = 0;
            const income = paySnap.docs.map(d => {
                const data = d.data();
                if(data.status === 'paid') incomeTotal += (data.amount || 0);
                return { id: d.id, ...data };
            });
            let expTotal = 0;
            const expenses = salSnap.docs.map(d => {
                const data = d.data();
                if(data.status === 'paid') expTotal += (data.netAmount || 0);
                return { id: d.id, ...data };
            });
            await generateMonthlyFinanceReportPDF(income, expenses, { incomeTotal, expenseTotal: expTotal, netProfit: incomeTotal - expTotal, pendingIncome: 0, pendingExpense: 0 }, financeMonth);
            toast.success("Financial Audit generated.");
        } catch (e) { console.error(e); toast.error("Finance export failed."); } finally { setExportingReport(null); }
    };

    const tabItems = [
        { id: 'overview', name: 'Strategic Overview', icon: TrendingUp },
        { id: 'directories', name: 'Identity & Registries', icon: FileText },
        { id: 'financials', name: 'Fiscal Audits', icon: Wallet },
    ];

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Reporting Hub</h1>
                    <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">
                        Institutional Intelligence & Directory Management
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-white/50 p-1.5 rounded-2xl border border-slate-200/60 max-w-fit gap-1 shadow-sm">
                {tabItems.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ReportTab)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                            activeTab === tab.id 
                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { title: 'Students', value: summaries.totalStudents, icon: Users, color: 'text-blue-500' },
                            { title: 'Faculty', value: summaries.totalTeachers, icon: GraduationCap, color: 'text-violet-500' },
                            { title: 'Revenue', value: `LKR ${summaries.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500' },
                            { title: 'Expenses', value: `LKR ${summaries.totalExpenses.toLocaleString()}`, icon: Clock, color: 'text-rose-500' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/60 transition-all duration-200 shadow-sm flex flex-col gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color.replace('text-', 'bg-').split('-').slice(0, 2).join('-')}-50 ${stat.color} transition-all shadow-sm`}>
                                    <stat.icon className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-0.5">{stat.title}</p>
                                    <p className="text-base font-bold text-slate-900 tracking-tight leading-none">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-primary/5 transition-all duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="w-1.5 h-10 bg-primary rounded-full transition-transform shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"></div>
                                    <div>
                                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">P&L Performance</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Monthly Revenue vs Payroll</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl">
                                    <BarChart3 className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                            <div className="h-[300px] w-full min-h-[300px]">
                                {analyticsLoading ? (
                                    <div className="h-full w-full bg-slate-50/50 rounded-2xl flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#94A3B8' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#94A3B8' }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
                                            <Bar dataKey="income" name="Revenue" fill="#10B981" radius={[6, 6, 0, 0]} barSize={24} />
                                            <Bar dataKey="expense" name="Payroll" fill="#F43F5E" radius={[6, 6, 0, 0]} barSize={24} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:border-primary/5 transition-all duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="w-1.5 h-10 bg-indigo-500 rounded-full transition-transform shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                                    <div>
                                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Net Profit Margin</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Institutional Economic Health</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-2xl">
                                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                            <div className="h-[300px] w-full min-h-[300px]">
                                {analyticsLoading ? (
                                    <div className="h-full w-full bg-slate-50/50 rounded-2xl flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#94A3B8' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: '900', fill: '#94A3B8' }} />
                                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                            <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'directories' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                    <div className="space-y-4">
                        <div className="flex items-center gap-5 px-1">
                            <div className="w-1.5 h-10 bg-slate-900 rounded-full"></div>
                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Institutional Master Registries</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Global System Directors</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                                { title: "Global Roster", action: handleMasterRosterExport, icon: Users, color: "text-blue-500 bg-blue-50", id: "roster-master" },
                                { title: "Academy Schedule", action: handleMasterClassExport, icon: BookOpen, color: "text-indigo-500 bg-indigo-50", id: "classes-master" },
                                { title: "Faculty Directory", action: handleTeacherExport, icon: GraduationCap, color: "text-violet-500 bg-violet-50", id: "teachers-master" },
                                { title: "Academic Grades", action: handleGradesExport, icon: Layers, color: "text-emerald-500 bg-emerald-50", id: "grades-master" },
                            ].map((item) => (
                                <button key={item.id} onClick={item.action} disabled={exportingReport !== null} className="bg-white p-5 rounded-2xl border border-slate-200/60 flex items-center justify-between hover:border-slate-900 transition-all group shadow-sm disabled:opacity-50">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0 shadow-sm`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider leading-none">{item.title}</span>
                                    </div>
                                    <Download className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-5 px-1">
                            <div className="w-1.5 h-10 bg-indigo-500 rounded-full"></div>
                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Targeted Data Extraction</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1.5 opacity-80">Operational Roster Filtering</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col gap-5 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-200">
                                        <UserCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Student Identity Digest</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1 opacity-70">Live Database Search</p>
                                    </div>
                                </div>
                                <div className="space-y-3 relative">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input placeholder="STUDENT ID OR FULL NAME..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] focus:ring-2 focus:ring-slate-900/10 outline-none transition-all" value={studentSearchTerm} onChange={(e) => { setStudentSearchTerm(e.target.value); setSelectedStudentId(""); }} />
                                    </div>
                                    {filteredStudents.length > 0 && !selectedStudentId && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden divide-y divide-slate-50">
                                            {filteredStudents.map(student => (
                                                <button key={student.id} onClick={() => handleStudentSpecificExport(student)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left group/res">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center text-[10px] font-black uppercase tracking-tighter">{student.name.charAt(0)}</div>
                                                        <div>
                                                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none">{student.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {student.studentId || student.id.slice(-6).toUpperCase()}</p>
                                                        </div>
                                                    </div>
                                                    <Download className="w-3.5 h-3.5 text-slate-300 group-hover/res:text-slate-900 transition-colors" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col gap-5 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Academic Section Ledger</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1 opacity-70">Filtered Registry List</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <select className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] appearance-none outline-none focus:ring-2 focus:ring-indigo-100" value={selectedClassId} onChange={(e)=>setSelectedClassId(e.target.value)}>
                                            <option value="">SELECT CLASS SECTION</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name} • {c.subject}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <button onClick={handleClassWiseExport} disabled={exportingReport !== null || !selectedClassId} className="px-6 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50">
                                        {exportingReport === "class-wise" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col gap-5 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100">
                                        <Layers className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Grade Profile List</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1 opacity-70">Enrollment Batch Roster</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <select className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] appearance-none outline-none focus:ring-2 focus:ring-emerald-100" value={selectedGradeId} onChange={(e)=>setSelectedGradeId(e.target.value)}>
                                            <option value="">SELECT GRADE ARCHITECTURE</option>
                                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <button onClick={handleGradeWiseExport} disabled={exportingReport !== null || !selectedGradeId} className="px-6 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50">
                                        {exportingReport === "grade-wise" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col gap-5 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-violet-100">
                                        <GraduationCap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800">Faculty Portfolio Dossier</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1 opacity-70">Staff Instructional Audit</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <select className="w-full pl-4 pr-10 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] appearance-none outline-none focus:ring-2 focus:ring-violet-100" value={selectedTeacherId} onChange={(e)=>setSelectedTeacherId(e.target.value)}>
                                            <option value="">SELECT ACADEMIC INSTRUCTOR</option>
                                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <button onClick={handleTeacherWiseExport} disabled={exportingReport !== null || !selectedTeacherId} className="px-6 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-100 disabled:opacity-50">
                                        {exportingReport === "teacher-wise" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'financials' && (
                <div className="animate-in slide-in-from-bottom-2 duration-500">
                    <div className="bg-white p-10 rounded-[4rem] border border-slate-200 shadow-2xl shadow-slate-100/50 relative overflow-hidden group/finance">
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] -mr-40 -mt-40 group-hover/finance:scale-110 transition-transform duration-[2000ms]"></div>
                        
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative z-10">
                            <div className="flex items-start gap-8">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white shadow-2xl shadow-emerald-200 flex items-center justify-center shrink-0">
                                    <Wallet className="w-8 h-8" />
                                </div>
                                <div className="max-w-md">
                                    {/* REDUCED FONT SIZE AS REQUESTED (from text-2xl to text-lg) */}
                                    <h3 className="font-black text-slate-900 text-lg tracking-tighter mb-3 uppercase">Institutional P&L Audit</h3>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] leading-relaxed opacity-70">
                                        Synthesize student revenue against faculty payroll obligations to generate a complete fiscal cycle analysis.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 bg-slate-50/80 p-2.5 rounded-[2rem] border border-slate-100 shadow-inner backdrop-blur-sm relative z-50">
                                {/* GLOBAL DESIGN CALENDAR / DATE PICKER */}
                                <div className="relative group/cal">
                                    <button 
                                        onClick={() => setIsFinanceMonthPickerOpen(!isFinanceMonthPickerOpen)}
                                        className="flex items-center gap-4 pl-5 pr-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-900 outline-none hover:border-emerald-500 transition-all min-w-[200px]"
                                    >
                                        <CalendarIcon className="w-4 h-4 text-emerald-500" />
                                        <span>{format(financeDate, "MMMM yyyy").toUpperCase()}</span>
                                    </button>
                                    
                                    {isFinanceMonthPickerOpen && (
                                        <div className="absolute top-full left-0 mt-3 bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 shadow-[0_32px_128px_-10px_rgba(16,185,129,0.2)] animate-in slide-in-from-top-4 duration-300 w-80 z-[100] border-t-4 border-t-emerald-500">
                                            <div className="flex items-center justify-between mb-6">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fiscal Horizon</h4>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setFinanceDate(subMonths(financeDate, 12))} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /></button>
                                                    <span className="text-[11px] font-black text-slate-900">{format(financeDate, "yyyy")}</span>
                                                    <button onClick={() => setFinanceDate(addMonths(financeDate, 12))} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronRight className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                {months.map((m, i) => {
                                                    const isSelected = financeDate.getMonth() === i;
                                                    return (
                                                        <button
                                                            key={m}
                                                            onClick={() => {
                                                                setFinanceDate(setMonth(financeDate, i));
                                                                setIsFinanceMonthPickerOpen(false);
                                                            }}
                                                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105' : 'hover:bg-slate-50 text-slate-500'}`}
                                                        >
                                                            {m}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                                                {years.slice(0, 3).map(y => (
                                                    <button
                                                        key={y}
                                                        onClick={() => setFinanceDate(setYear(financeDate, y))}
                                                        className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${financeDate.getFullYear() === y ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        {y}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button 
                                    onClick={handleFinanceExport}
                                    disabled={exportingReport !== null}
                                    className="px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 hover:shadow-emerald-300 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    {exportingReport === "finance" ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4" />
                                    )}
                                    Export P&L Ledger
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center gap-4 px-8 py-6 bg-slate-900 rounded-[2rem] shadow-2xl relative overflow-hidden group/notice">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent"></div>
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.8)]"></div>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] relative z-10">
                            Verification Engine: <span className="text-white/90">Institutional P&L is ready for cycle {format(financeDate, "MMM yyyy").toUpperCase()}. Ensure all terminal payments are verified before generation.</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
