"use client";

import { AlertTriangle, Loader2, CheckCircle, Info } from "lucide-react";
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
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  variant = "danger",
}: ConfirmModalProps) {
  const variantConfig = {
    danger: {
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      glow: "shadow-red-100",
      ring: "ring-red-100",
      button: "bg-red-600 hover:bg-red-700 shadow-red-200",
      icon: AlertTriangle,
    },
    warning: {
      iconBg: "bg-amber-50",
      iconColor: "text-amber-500",
      glow: "shadow-amber-100",
      ring: "ring-amber-100",
      button: "bg-amber-600 hover:bg-amber-700 shadow-amber-200",
      icon: AlertTriangle,
    },
    info: {
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      glow: "shadow-blue-100",
      ring: "ring-blue-100",
      button: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
      icon: Info,
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center text-center space-y-4 pt-2 pb-2">
        {/* Icon — no glow duplication of title */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${config.iconBg} ${config.iconColor} ring-8 ${config.ring} shadow-xl ${config.glow}`}>
          <Icon className="w-8 h-8" />
        </div>

        {/* Message only — title already in Modal header */}
        <p className="text-slate-500 leading-relaxed font-medium text-sm max-w-xs">
          {message}
        </p>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 w-full pt-4 border-t border-slate-50 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all disabled:opacity-50 no-tap"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-3 text-white rounded-2xl text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 no-tap ${config.button}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
