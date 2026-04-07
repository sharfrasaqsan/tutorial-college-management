"use client";

import { useAuth } from "@/context/AuthContext";
import { Bell, Search, User as UserIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminTopbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // Format pathname loosely for header
  const title = pathname.split("/").pop()?.replace(/-/g, " ") || "Dashboard";
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm flex items-center justify-between px-6 sticky top-0 z-10 md:pl-70 md:ml-64 hidden md:flex">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-xl font-semibold text-slate-800">{formattedTitle}</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative text-slate-400 focus-within:text-primary hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search students, classes..." 
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-64 transition-all"
          />
        </div>
        
        <button className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-slate-200 mx-2"></div>
        
        <Link href="/admin/profile" className="flex items-center gap-3 hover:opacity-80 transition-all group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-black text-slate-800 leading-tight">Admin Identity</p>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">{user?.email}</p>
          </div>
          <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-white transition-all">
            <UserIcon className="w-5 h-5" />
          </div>
        </Link>
      </div>
    </header>
  );
}
