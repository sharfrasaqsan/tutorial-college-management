"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  collection, query, orderBy, limit, getDocs, Timestamp, where, onSnapshot 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  History, Users, Calendar, Search, ArrowLeft, 
  ChevronRight, CheckCircle2, XCircle, Clock, BookOpen,
  Filter, Download, ArrowUpRight, LayoutGrid, List
} from "lucide-react";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { format } from "date-fns";
import { AttendanceRecord, Class } from "@/types/models";

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classes
      const classesSnap = await getDocs(collection(db, "classes"));
      const classesList = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Class));
      setClasses(classesList);

      // 2. Fetch Recent Attendance
      const q = query(
        collection(db, "attendance"),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      setRecords(list);
    } catch (error) {
      console.error("Error loading attendance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = r.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.teacherName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = !selectedClassId || r.classId === selectedClassId;
      return matchesSearch && matchesClass;
    });
  }, [records, searchTerm, selectedClassId]);

  const stats = useMemo(() => {
    const activeRecords = selectedClassId 
      ? records.filter(r => r.classId === selectedClassId)
      : records;

    return {
      totalSessions: activeRecords.length,
      avgAttendance: activeRecords.length > 0 
        ? Math.round(activeRecords.reduce((acc, r) => acc + (r.totalPresent / (r.totalPresent + r.totalAbsent) * 100), 0) / activeRecords.length)
        : 0,
      totalStudentsLogged: activeRecords.reduce((acc, r) => acc + r.totalPresent, 0)
    };
  }, [records, selectedClassId]);

  const openDetails = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsDetailOpen(true);
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Standard Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Institutional Attendance
          </h1>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-1">
            Presence ledger {selectedClassId ? `for ${selectedClass?.name}` : "across all units"}
          </p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner mr-2">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
           </div>
          <button className="px-5 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Export Data
          </button>
          <Link 
            href="/admin/dashboard"
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-black transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Audit Points', value: stats.totalSessions, icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Presence Index', value: `${stats.avgAttendance}%`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Verified Students', value: stats.totalStudentsLogged, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-6 group hover:border-primary/20 transition-all">
            <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 leading-none tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 🧩 Class Selection Grid */}
      {viewMode === 'grid' && !selectedClassId && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
           <div className="p-10 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 rounded-3xl bg-white shadow-xl flex items-center justify-center text-primary mb-4">
                <BookOpen className="w-8 h-8" />
             </div>
             <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Split by Academic Units</h3>
             <p className="text-xs text-slate-500 max-w-xs mt-2 font-medium">Select a class to view its dedicated presence history and roll call archives.</p>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {loading ? [1,2,3,4].map(i => <Skeleton key={i} variant="rect" width="100%" height="100px" className="rounded-2xl" />) :
              classes.map((cls) => {
                const classRecords = records.filter(r => r.classId === cls.id);
                return (
                  <button 
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-primary hover:shadow-xl transition-all group text-left"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="px-2 py-0.5 bg-slate-50 rounded text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover:bg-primary/10 group-hover:text-primary transition-all">Active</div>
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1 truncate">{cls.name}</h4>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{classRecords.length} Records</p>
                       <ChevronRight className="w-3 h-3 text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })
             }
           </div>
        </div>
      )}

      {/* 📋 Record List View (Filtered or All) */}
      {(viewMode === 'list' || selectedClassId) && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedClassId && (
                <button 
                  onClick={() => setSelectedClassId(null)}
                  className="p-2 hover:bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400 hover:text-primary transition-all group"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:translate-x-[-2px] transition-transform" />
                </button>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {selectedClassId ? `History: ${selectedClass?.name}` : "Global Presence Ledger"}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Institutional Record Archive 2026
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search ledger..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {filteredRecords.length} Entries Logged
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Session Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Faculty Authority</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Audit Result</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? [1,2,3].map(i => <tr key={i}><td colSpan={4} className="p-10 animate-pulse bg-slate-50/50"></td></tr>) :
                    filteredRecords.length > 0 ? filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary transition-all">
                                <BookOpen className="w-5 h-5" />
                             </div>
                             <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                   <p className="font-bold text-slate-800">{record.className}</p>
                                   <span className="text-[9px] font-black bg-primary/5 text-primary px-1.5 py-0.5 rounded uppercase">{record.grade}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                   <Calendar className="w-3 h-3" /> {record.date}
                                </p>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 font-semibold text-slate-600">{record.teacherName}</td>
                        <td className="px-6 py-5 text-center">
                          <div className="inline-flex flex-col items-center">
                             <div className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-tighter border border-emerald-100">
                                {Math.round((record.totalPresent / (record.totalPresent + record.totalAbsent)) * 100)}% PRESENCE
                             </div>
                             <p className="text-[8px] font-bold text-slate-300 mt-1 uppercase tracking-[0.2em]">{record.totalPresent} Verified / {record.totalPresent + record.totalAbsent} Enrolled</p>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => openDetails(record)}
                            className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-primary hover:text-white transition-all shadow-sm"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-20 text-center">
                          <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">No matching logs found</p>
                        </td>
                      </tr>
                    )
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailOpen && selectedRecord && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDetailOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="p-8 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.3em]">Institutional Roll Call</h3>
                    <button onClick={() => setIsDetailOpen(false)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all text-white/60 hover:text-white">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                  <h3 className="text-xl font-black mb-1">{selectedRecord.className}</h3>
                  <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">{selectedRecord.grade} • {selectedRecord.date}</p>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Present</p>
                    <p className="text-2xl font-black text-emerald-700">{selectedRecord.totalPresent}</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100 text-center">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Absent</p>
                    <p className="text-2xl font-black text-rose-700">{selectedRecord.totalAbsent}</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
                  {selectedRecord.records.map((student, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-50 bg-slate-50/30 flex items-center justify-between group hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${student.isPresent ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {student.studentName.charAt(0)}
                        </div>
                        <p className="text-xs font-bold text-slate-700">{student.studentName}</p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${student.isPresent ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {student.isPresent ? 'Present' : 'Absent'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faculty Member</p>
                      <p className="text-xs font-bold text-slate-800">{selectedRecord.teacherName}</p>
                   </div>
                   <button onClick={() => setIsDetailOpen(false)} className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black transition-all shadow-lg">
                     Close Record
                   </button>
                </div>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
