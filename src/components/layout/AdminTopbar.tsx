"use client";

import { useAuth } from "@/context/AuthContext";
import { Search, User as UserIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import NotificationCenter from "./NotificationCenter";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminTopbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTitle() {
      const parts = pathname.split("/");
      if (parts.includes("students") && parts.length > parts.indexOf("students") + 1) {
        const id = parts[parts.indexOf("students") + 1];
        if (id) {
            try {
                const snap = await getDoc(doc(db, "students", id));
                if (snap.exists()) setDynamicTitle(snap.data().name);
                else setDynamicTitle("Student Profile");
            } catch {
                setDynamicTitle("Student Profile");
            }
        }
      } else if (parts.includes("teachers") && parts.length > parts.indexOf("teachers") + 1) {
        const id = parts[parts.indexOf("teachers") + 1];
        if (id) {
            try {
                const snap = await getDoc(doc(db, "teachers", id));
                if (snap.exists()) setDynamicTitle(snap.data().name);
                else setDynamicTitle("Teacher Profile");
            } catch {
                setDynamicTitle("Teacher Profile");
            }
        }
      } else {
         setDynamicTitle(null);
      }
    }
    fetchTitle();
  }, [pathname]);
  
  // Format pathname loosely for header
  const title = dynamicTitle || pathname.split("/").pop()?.replace(/-/g, " ") || "Dashboard";
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
        
        <NotificationCenter />        
        <div className="h-8 w-px bg-slate-200 mx-2"></div>
        
        <Link href="/admin/profile" className="flex items-center gap-3 transition-all group no-tap">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user?.email ? user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Administrator"}
            </p>
            <p className="text-[10px] font-medium text-slate-400 truncate max-w-[140px]">{user?.email}</p>
          </div>
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all">
              <UserIcon className="w-4.5 h-4.5" />
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
