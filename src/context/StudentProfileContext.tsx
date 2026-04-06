"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import StudentProfileModal from '@/components/admin/StudentProfileModal';

interface StudentProfileContextType {
  openStudentProfile: (studentId: string) => void;
  closeStudentProfile: () => void;
}

const StudentProfileContext = createContext<StudentProfileContextType | undefined>(undefined);

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const openStudentProfile = (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsOpen(true);
  };

  const closeStudentProfile = () => {
    setIsOpen(false);
    // Use a small timeout to clear the state after the modal animation completes
    setTimeout(() => setSelectedStudentId(null), 300);
  };

  return (
    <StudentProfileContext.Provider value={{ openStudentProfile, closeStudentProfile }}>
      {children}
      {selectedStudentId && (
        <StudentProfileModal 
          studentId={selectedStudentId} 
          isOpen={isOpen} 
          onClose={closeStudentProfile} 
        />
      )}
    </StudentProfileContext.Provider>
  );
}

export function useStudentProfile() {
  const context = useContext(StudentProfileContext);
  if (context === undefined) {
    throw new Error('useStudentProfile must be used within a StudentProfileProvider');
  }
  return context;
}
