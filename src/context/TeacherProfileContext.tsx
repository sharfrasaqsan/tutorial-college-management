"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface TeacherProfileContextType {
  openTeacherProfile: (teacherId: string) => void;
  closeTeacherProfile: () => void;
}

const TeacherProfileContext = createContext<TeacherProfileContextType | undefined>(undefined);

export function TeacherProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const openTeacherProfile = (teacherId: string) => {
    // Determine the base path based on the current user's portal
    const basePath = pathname?.startsWith('/teacher') ? '/teacher/teachers' : '/admin/teachers';
    router.push(`${basePath}/${teacherId}`);
  };

  const closeTeacherProfile = () => {
    router.back();
  };

  return (
    <TeacherProfileContext.Provider value={{ openTeacherProfile, closeTeacherProfile }}>
      {children}
    </TeacherProfileContext.Provider>
  );
}

export function useTeacherProfile() {
  const context = useContext(TeacherProfileContext);
  if (context === undefined) {
    throw new Error('useTeacherProfile must be used within a TeacherProfileProvider');
  }
  return context;
}
