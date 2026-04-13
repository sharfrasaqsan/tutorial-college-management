"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ArrowRight, 
  History, 
  Trash2,
  CheckCircle
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function AdminNotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => n.status === 'unread') 
    : notifications;

  const handleClearHistory = async () => {
    setIsClearing(true);
    await clearAll();
    setIsClearing(false);
    setIsConfirmOpen(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default: return <Info className="w-5 h-5 text-indigo-500" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* 🏛️ Header Segment */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 py-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Activity Log</h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Centralized Institutional Event Feed • {unreadCount} Pending
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={markAllAsRead}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 shadow-sm"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Mark All Read
          </button>
          <button 
            onClick={() => setIsConfirmOpen(true)}
            className="px-5 py-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear History
          </button>
        </div>
      </div>

      {/* 🚀 Filter Hub */}
      <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-2xl w-fit border border-slate-200/60">
        {[
          { id: 'all', label: 'All Activity' },
          { id: 'unread', label: `Unread (${unreadCount})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-6 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${filter === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 📋 Notification Registry */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <div 
                key={notif.id}
                className={`group p-8 transition-all hover:bg-slate-50 relative ${notif.status === 'unread' ? 'bg-indigo-50/20' : ''}`}
              >
                <div className="flex items-start gap-6">
                  <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${
                    notif.type === 'success' ? 'bg-emerald-50' : 
                    notif.type === 'warning' ? 'bg-amber-50' : 
                    notif.type === 'error' ? 'bg-rose-50' : 'bg-indigo-50'
                  }`}>
                    {getTypeIcon(notif.type)}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-base font-bold transition-colors ${notif.status === 'unread' ? 'text-indigo-900' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        {format(notif.createdAt.toDate(), "MMM dd, hh:mm a")}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-3xl">
                      {notif.message}
                    </p>
                    
                    <div className="pt-4 flex items-center gap-4">
                      {notif.link && (
                        <Link 
                          href={notif.link}
                          onClick={() => markAsRead(notif.id)}
                          className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:gap-3 transition-all"
                        >
                          Access Resource <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {notif.status === 'unread' && (
                        <button 
                          onClick={() => markAsRead(notif.id)}
                          className="text-[10px] font-bold text-slate-400 hover:text-emerald-600 uppercase tracking-wider transition-colors"
                        >
                          Mark as seen
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {notif.status === 'unread' && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                )}
              </div>
            ))
          ) : (
            <div className="py-24 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Bell className="w-10 h-10 text-slate-200" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Quiet for now</h3>
                <p className="text-sm text-slate-400 font-medium">No new activity logs available in the central repository.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleClearHistory}
        loading={isClearing}
        title="Purge Activity Log?"
        message="This operation will permanently remove all institutional activity records for your account. This action is definitive and cannot be reverted. Proceed with authority?"
        confirmText="Confirm Purge"
        cancelText="Retain Records"
      />
    </div>
  );
}
