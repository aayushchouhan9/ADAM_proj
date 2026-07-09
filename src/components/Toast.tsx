'use client';

import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warn: '⚠️',
  info: 'ℹ️',
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-950/90 border-emerald-700 text-emerald-200',
  error: 'bg-red-950/90 border-red-700 text-red-200',
  warn: 'bg-amber-950/90 border-amber-700 text-amber-200',
  info: 'bg-slate-900/90 border-slate-700 text-slate-200',
};

function ToastMessage({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-md shadow-xl text-sm font-medium max-w-sm animate-slide-in ${COLORS[toast.type]}`}
    >
      <span className="shrink-0 text-base">{ICONS[toast.type]}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-current opacity-60 hover:opacity-100 cursor-pointer bg-transparent border-0 ml-1 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastMessage toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
