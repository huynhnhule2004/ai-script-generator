"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number; // duration in ms, default 3000
}

export default function Toast({ message, onClose, duration = 3000 }: ToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!message) return;

    setProgress(100);
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPercent = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPercent);

      if (remainingPercent <= 0) {
        clearInterval(interval);
        onClose();
      }
    }, 20);

    return () => clearInterval(interval);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed top-20 right-6 z-50 overflow-hidden bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-5 py-4 rounded-2xl shadow-2xl border border-zinc-700/80 dark:border-zinc-200 animate-in fade-in slide-in-from-top-5 duration-300 font-bold text-xs sm:text-sm min-w-[320px]">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-500/30">
            ✓
          </span>
          <span className="truncate">{message}</span>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white dark:hover:text-zinc-900 transition-colors p-1 text-xs font-bold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 flex items-center justify-center h-6 w-6"
          title="Đóng thông báo"
        >
          ✕
        </button>
      </div>

      {/* Shrinking Animated Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 dark:bg-zinc-200">
        <div
          className="h-full bg-emerald-500 rounded-r-full"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}
