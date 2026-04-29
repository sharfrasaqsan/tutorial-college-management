"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Layers, 
  CalendarDays, 
  CreditCard, 
  Banknote,
  Wallet,
  ClipboardCheck,
  Settings,
  History,
  LogOut,
  FileText,
  ShieldCheck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Overview", items: [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Timetable", href: "/admin/timetable", icon: CalendarDays },
  ]},
  { label: "Academic", items: [
    { name: "Students", href: "/admin/students", icon: Users },
    { name: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { name: "Subjects", href: "/admin/subjects", icon: BookOpen },
    { name: "Grades", href: "/admin/grades", icon: GraduationCap },
    { name: "Classes", href: "/admin/classes", icon: BookOpen },
    { name: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  ]},
  { label: "Finance", items: [
    { name: "Finance Analytics", href: "/admin/finance", icon: Wallet },
    { name: "Student Fees", href: "/admin/payments", icon: CreditCard },
    { name: "Teacher Payments", href: "/admin/salaries", icon: Banknote },
  ]},
  { label: "System", items: [
    { name: "Reports", href: "/admin/reports", icon: FileText },
    { name: "Activity Logs", href: "/admin/notifications", icon: History },
    { name: "Profile", href: "/admin/profile", icon: Settings },
  ]},
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-slate-100 shadow-[1px_0_0_0_rgba(0,0,0,0.04)] fixed top-0 left-0 z-20">
        {/* Brand */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 tracking-tight leading-none">SmartAcademy</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-5 scrollbar-hide">
          {navItems.map((group) => (
            <div key={group.label}>
              <h3 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.15em] mb-2 px-3">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium border ${
                          isActive
                            ? "bg-primary/8 text-primary border-primary/10 font-semibold"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          isActive 
                            ? "bg-primary text-white shadow-md shadow-primary/30" 
                            : "bg-transparent text-slate-400 group-hover:bg-slate-100"
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {item.name}
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100">
          <div className="px-3 py-3 bg-slate-50 rounded-xl border border-slate-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">System Status</p>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">All Systems Operational</p>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all no-tap"
          >
            <div className="w-7 h-7 rounded-lg bg-transparent flex items-center justify-center">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 z-50 flex items-center justify-around px-1 safe-area-inset-bottom">
        {[
          { name: "Home", href: "/admin/dashboard", icon: LayoutDashboard },
          { name: "Students", href: "/admin/students", icon: Users },
          { name: "Classes", href: "/admin/classes", icon: BookOpen },
          { name: "Finance", href: "/admin/payments", icon: CreditCard },
          { name: "Schedule", href: "/admin/timetable", icon: CalendarDays },
        ].map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center w-full h-full gap-1 no-tap"
            >
              <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isActive ? "bg-primary/10" : ""
              }`}>
                <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-slate-400"}`} />
              </div>
              <span className={`text-[9px] font-bold tracking-wide transition-colors ${isActive ? "text-primary" : "text-slate-400"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
