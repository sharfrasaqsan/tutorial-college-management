"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface StudentProfileContextType {
  openStudentProfile: (studentId: string) => void;
  closeStudentProfile: () => void;
}

const StudentProfileContext = createContext<StudentProfileContextType | undefined>(undefined);

export function StudentProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const openStudentProfile = (studentId: string) => {
    const basePath = pathname.startsWith('/admin') ? '/admin' : '/teacher';
    router.push(`${basePath}/students/${studentId}`);
  };

  const closeStudentProfile = () => {
    router.back();
  };

  return (
    <StudentProfileContext.Provider value={{ openStudentProfile, closeStudentProfile }}>
      {children}
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
