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
  ClipboardCheck,
  Settings,
  LogOut
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Overview", items: [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Timetable", href: "/admin/timetable", icon: CalendarDays },
  ]},
  { label: "Academics", items: [
    { name: "Students", href: "/admin/students", icon: Users },
    { name: "Teachers", href: "/admin/teachers", icon: GraduationCap },
    { name: "Subjects", href: "/admin/subjects", icon: BookOpen },
    { name: "Grades", href: "/admin/grades", icon: Layers },
    { name: "Classes", href: "/admin/classes", icon: Layers },
    { name: "Attendance", href: "/admin/attendance", icon: ClipboardCheck },
  ]},
  { label: "Finance", items: [
    { name: "Payments", href: "/admin/payments", icon: CreditCard },
    { name: "Salaries", href: "/admin/salaries", icon: Banknote },
  ]},
  { label: "Settings", items: [
    { name: "Profile", href: "/admin/profile", icon: Settings },
  ]},
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 h-screen bg-white border-r border-slate-100 shadow-2xl shadow-slate-200/20 fixed top-0 left-0 z-20">
        <div className="h-24 flex items-center px-8 border-b border-slate-50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -mr-12 -mt-12 transition-transform duration-700 group-hover:scale-150"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-xl shadow-primary/20 group-hover:rotate-6 transition-transform duration-500">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
               <p className="text-xl font-bold text-slate-900 tracking-tight leading-none">SmartAcademy</p>
               <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] mt-1.5 flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
                  Admin Terminal
               </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-8 px-5 space-y-10 custom-scrollbar">
          {navItems.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 px-4 flex items-center gap-3">
                <div className="w-1 h-3 bg-slate-200 rounded-full"></div>
                {group.label}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-[13px] group/link ${
                          isActive
                            ? "bg-slate-900 text-white shadow-xl shadow-slate-200 font-bold"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                        }`}
                      >
                        <Icon className={`w-4.5 h-4.5 transition-transform duration-500 group-hover/link:scale-110 ${isActive ? "text-white" : "text-slate-400"}`} />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all group"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-500 transition-colors" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-50 flex items-center justify-around px-2 pb-safe">
        {[
          { name: "Dash", href: "/admin/dashboard", icon: LayoutDashboard },
          { name: "Students", href: "/admin/students", icon: Users },
          { name: "Classes", href: "/admin/classes", icon: Layers },
          { name: "Finance", href: "/admin/payments", icon: CreditCard },
          { name: "More", href: "/admin/timetable", icon: CalendarDays },
        ].map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? "text-slate-900" : "text-slate-400"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className={`text-[11px] font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
