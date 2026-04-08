"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  CalendarDays, 
  History,
  Banknote,
  Settings,
  LogOut
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Main", items: [
    { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { name: "Session Ledger", href: "/teacher/ledger", icon: History },
    { name: "My Classes", href: "/teacher/classes", icon: Layers },
  ]},
  { label: "Academic", items: [
    { name: "Students List", href: "/teacher/students", icon: Users },
    { name: "Timetable", href: "/teacher/timetable", icon: CalendarDays },
  ]},
  { label: "Earnings", items: [
    { name: "Salary History", href: "/teacher/salary", icon: Banknote },
  ]},
  { label: "Account", items: [
    { name: "My Profile", href: "/teacher/profile", icon: Settings },
  ]},
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-slate-200 shadow-sm fixed top-0 left-0 z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              TC
            </div>
            Teacher Portal
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
                            ? "bg-indigo-50 text-indigo-700 before:absolute before:left-0 before:h-8 before:w-1 before:bg-indigo-600 before:rounded-r-full relative"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
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
          { name: "Dash", href: "/teacher/dashboard", icon: LayoutDashboard },
          { name: "Ledger", href: "/teacher/ledger", icon: History },
          { name: "Classes", href: "/teacher/classes", icon: Layers },
          { name: "Schedule", href: "/teacher/timetable", icon: CalendarDays },
          { name: "Salary", href: "/teacher/salary", icon: Banknote },
        ].map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                isActive ? "text-indigo-600" : "text-slate-500"
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
