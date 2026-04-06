"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import TeacherProfileModal from '@/components/admin/TeacherProfileModal';

interface TeacherProfileContextType {
  openTeacherProfile: (teacherId: string) => void;
  closeTeacherProfile: () => void;
}

const TeacherProfileContext = createContext<TeacherProfileContextType | undefined>(undefined);

export function TeacherProfileProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const openTeacherProfile = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setIsOpen(true);
  };

  const closeTeacherProfile = () => {
    setIsOpen(false);
    setTimeout(() => setSelectedTeacherId(null), 300);
  };

  return (
    <TeacherProfileContext.Provider value={{ openTeacherProfile, closeTeacherProfile }}>
      {children}
      {selectedTeacherId && (
        <TeacherProfileModal 
          teacherId={selectedTeacherId} 
          isOpen={isOpen} 
          onClose={closeTeacherProfile} 
        />
      )}
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
