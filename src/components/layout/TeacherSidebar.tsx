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
  Bell,
  LogOut,
  GraduationCap
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { label: "Overview", items: [
    { name: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { name: "Session Ledger", href: "/teacher/ledger", icon: History },
    { name: "My Classes", href: "/teacher/classes", icon: Layers },
  ]},
  { label: "Academic", items: [
    { name: "Students", href: "/teacher/students", icon: Users },
    { name: "Schedule", href: "/teacher/timetable", icon: CalendarDays },
  ]},
  { label: "Finance", items: [
    { name: "My Salary", href: "/teacher/salary", icon: Banknote },
  ]},
  { label: "Account", items: [
    { name: "Notifications", href: "/teacher/notifications", icon: Bell },
    { name: "Profile", href: "/teacher/profile", icon: Settings },
  ]},
];

export default function TeacherSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen bg-white border-r border-slate-100 shadow-[1px_0_0_0_rgba(0,0,0,0.04)] fixed top-0 left-0 z-20">
        {/* Brand */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[var(--color-teacher)] to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 tracking-tight leading-none">SmartAcademy</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Faculty Portal</p>
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
                            ? "bg-indigo-50/80 text-[var(--color-teacher)] border-indigo-100/60 font-semibold"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          isActive 
                            ? "bg-[var(--color-teacher)] text-white shadow-md shadow-indigo-500/30" 
                            : "bg-transparent text-slate-400"
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {item.name}
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-teacher)]" />
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
          <div className="px-3 py-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[var(--color-teacher)]/10 flex items-center justify-center">
                <GraduationCap className="w-3.5 h-3.5 text-[var(--color-teacher)]" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">Session Active</p>
                <p className="text-[10px] font-bold text-[var(--color-teacher)] mt-0.5">Faculty Account</p>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all no-tap"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 z-50 flex items-center justify-around px-1">
        {[
          { name: "Home", href: "/teacher/dashboard", icon: LayoutDashboard },
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
              className="flex flex-col items-center justify-center w-full h-full gap-1 no-tap"
            >
              <div className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isActive ? "bg-indigo-50" : ""
              }`}>
                <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-[var(--color-teacher)]" : "text-slate-400"}`} />
              </div>
              <span className={`text-[9px] font-bold tracking-wide transition-colors ${isActive ? "text-[var(--color-teacher)]" : "text-slate-400"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
