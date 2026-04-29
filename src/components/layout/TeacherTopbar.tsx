"use client";

import { useAuth } from "@/context/AuthContext";
import { Search, User as UserIcon, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import NotificationCenter from "./NotificationCenter";

export default function TeacherTopbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [teacherName, setTeacherName] = useState("Faculty User");
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
  const rawTitle = dynamicTitle || pathname.split("/").pop()?.replace(/-/g, " ") || "Overview";
  const formattedTitle = rawTitle === "attendance" ? "Session History" : (rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1));

  useEffect(() => {
    async function fetchTeacher() {
      if (user?.uid) {
        const docRef = doc(db, "teachers", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTeacherName(docSnap.data().name);
        }
      }
    }
    fetchTeacher();
  }, [user]);

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm flex items-center justify-between px-6 sticky top-0 z-10 md:ml-64 hidden md:flex">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex flex-col">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">{formattedTitle}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Session Active</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative text-slate-400 focus-within:text-indigo-600 hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search students, resources..." 
            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
          />
        </div>
        
        <NotificationCenter />
        
        <div className="h-8 w-px bg-slate-200 mx-1"></div>
        
        <Link href="/teacher/profile" className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-1.5 px-3 rounded-full hover:bg-slate-100 transition-all cursor-pointer group">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">{teacherName}</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight">Instructor Badge</p>
          </div>
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white border border-indigo-700 shadow-sm shadow-indigo-100 group-hover:scale-105 transition-transform">
            <UserIcon className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </header>
  );
}
