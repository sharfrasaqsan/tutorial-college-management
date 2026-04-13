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
  History,
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
      <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-slate-200 shadow-sm fixed top-0 left-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              SA
            </div>
            Admin Portal
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navItems.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">
                {group.label}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                          isActive
                            ? "bg-primary/5 text-primary before:absolute before:left-0 before:h-8 before:w-1 before:bg-primary before:rounded-r-full relative"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-slate-400"}`} />
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
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all font-bold"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
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
                isActive ? "text-primary" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
