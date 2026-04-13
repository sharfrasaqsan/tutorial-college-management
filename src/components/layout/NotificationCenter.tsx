"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, Clock, ExternalLink, X } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTypeStyles = (type: Notification["type"]) => {
    switch (type) {
      case "success": return { icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50" };
      case "warning": return { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" };
      case "error": return { icon: XCircle, color: "text-rose-500", bg: "bg-rose-50" };
      default: return { icon: Info, color: "text-blue-500", bg: "bg-blue-50" };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 🔔 Notification Bell */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300 ${isOpen ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'hover:bg-slate-100 text-slate-600'}`}
      >
        <Bell className={`w-5 h-5 ${isOpen ? 'animate-none' : 'group-hover:animate-bounce'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] font-black text-white items-center justify-center border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* 📖 Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-4 w-[380px] bg-white rounded-[2rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden z-[100] animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-50 bg-white sticky top-0 z-10 flex items-center justify-between">
            <div>
                <h3 className="font-black text-slate-800 tracking-tight text-sm">Notifications</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-0.5">
                    {unreadCount} unread mission alerts
                </p>
            </div>
            <button 
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          </div>

          {/* List */}
          <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="p-10 text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-slate-100 border-t-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Synchronizing Alerts...</p>
                </div>
            ) : notifications.length === 0 ? (
                <div className="p-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 mx-auto mb-4 border border-slate-50">
                        <Bell className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-black text-slate-800 tracking-tight">System Clear</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">No new notifications detected</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-50">
                    {notifications.map((notif) => {
                        const style = getTypeStyles(notif.type);
                        const Icon = style.icon;
                        const time = notif.createdAt?.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : 'Just now';

                        return (
                            <div 
                                key={notif.id}
                                className={`px-6 py-5 hover:bg-slate-50 transition-all group relative cursor-pointer ${notif.status === 'unread' ? 'bg-primary/[0.02]' : ''}`}
                                onClick={() => markAsRead(notif.id)}
                            >
                                {notif.status === 'unread' && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-primary rounded-r-full"></div>
                                )}
                                
                                <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${style.bg} ${style.color} shadow-sm group-hover:scale-110 transition-transform`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className={`text-xs font-black truncate tracking-tight ${notif.status === 'unread' ? 'text-slate-900' : 'text-slate-500'}`}>{notif.title}</h4>
                                            <span className="text-[9px] font-black text-slate-300 uppercase whitespace-nowrap">{time}</span>
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 leading-relaxed">
                                            {notif.message}
                                        </p>
                                        
                                        {notif.link && (
                                            <Link 
                                                href={notif.link} 
                                                className="inline-flex items-center gap-1 mt-2 text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                                            >
                                                View Details <ExternalLink className="w-2.5 h-2.5" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-50 text-center">
            <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">
                View all activity logs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
