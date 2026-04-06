"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import StudentProfileModal from "@/components/admin/StudentProfileModal";

interface StudentProfileContextType {
  openStudentProfile: (studentId: string) => void;
  closeStudentProfile: () => void;
}

const StudentProfileContext = createContext<StudentProfileContextType | undefined>(undefined);

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const openStudentProfile = (studentId: string) => {
    setActiveStudentId(studentId);
    setIsOpen(true);
  };

  const closeStudentProfile = () => {
    setIsOpen(false);
    // don't clear immediate to avoid flash
  };

  return (
    <StudentProfileContext.Provider value={{ openStudentProfile, closeStudentProfile }}>
      {children}
      <StudentProfileModal 
        isOpen={isOpen} 
        onClose={closeStudentProfile} 
        studentId={activeStudentId} 
      />
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  const context = useContext(StudentProfileContext);
  if (context === undefined) {
    throw new Error("useStudentProfile must be used within a StudentProfileProvider");
  }
  return context;
}
