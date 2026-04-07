"use client";

import { useAuth } from "@/context/AuthContext";
import { Bell, Search, User as UserIcon, Clock } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function TeacherTopbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [teacherName, setTeacherName] = useState("Faculty User");
  
  // Format pathname loosely for header
  const title = pathname.split("/").pop()?.replace(/-/g, " ") || "Overview";
  const formattedTitle = title.charAt(0).toUpperCase() + title.slice(1);

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
        
        <button className="relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors border border-slate-200">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
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
