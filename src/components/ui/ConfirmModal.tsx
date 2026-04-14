"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import Modal from "./Modal";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  variant?: "danger" | "warning" | "info";
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm Delete",
  cancelText = "Cancel",
  loading = false,
  variant = "danger",
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      icon: "bg-red-100 text-red-600",
      button: "bg-red-600 hover:bg-red-700 shadow-red-200",
      border: "border-red-100",
    },
    warning: {
      icon: "bg-amber-100 text-amber-600",
      button: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
      border: "border-amber-100",
    },
    info: {
      icon: "bg-blue-100 text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
      border: "border-blue-100",
    },
  };

  const style = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col items-center text-center space-y-4 py-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-2 ${style.icon} animate-pulse-subtle`}>
          <AlertTriangle className="w-10 h-10" />
        </div>
        
        <div className="space-y-2 px-4">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{title}</h3>
          <p className="text-slate-500 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-6 border-t border-slate-50 mt-4 px-2">
          <button 
            type="button" 
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            onClick={onConfirm}
            disabled={loading}
            className={`px-6 py-3 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${style.button}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
