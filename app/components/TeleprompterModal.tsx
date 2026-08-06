"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

interface TeleprompterModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText: string;
  char1Name: string;
  char2Name: string;
}

export default function TeleprompterModal({
  isOpen,
  onClose,
  scriptText,
  char1Name,
  char2Name,
}: TeleprompterModalProps) {
  const [fontSize, setFontSize] = useState(28); // Default large font size
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;

    const autoScroll = () => {
      if (scrollRef.current && isScrolling) {
        scrollRef.current.scrollTop += scrollSpeed * 0.5;
        animationFrameId = requestAnimationFrame(autoScroll);
      }
    };

    if (isScrolling) {
      animationFrameId = requestAnimationFrame(autoScroll);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isScrolling, scrollSpeed]);

  if (!isOpen) return null;

  // Process text so character names and section titles are formatted
  let formattedText = scriptText.replace(/\*\*/g, "");
  formattedText = formattedText.replace(/(^|\n)(Phần \d+.*?|Phân đoạn \d+.*?|Chương \d+.*?)(?=\n|$)/gi, "$1\n## 📌 $2\n");
  formattedText = formattedText.replace(/(\[.*?\])/g, "**$1**");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white animate-in fade-in duration-300 font-sans transition-colors">
      {/* Teleprompter Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-white/90 dark:bg-zinc-900/90 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-md gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30">
            🎬
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Máy Đọc Kịch Bản Studio</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Chế độ đọc kịch bản tập luyện / thu âm</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Scroll Controls */}
          <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800/80 px-4 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setIsScrolling(!isScrolling)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-bold text-sm transition-all ${
                isScrolling
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-600/30"
              }`}
            >
              {isScrolling ? "⏸ Tạm Dừng" : "▶ Cuộn Tự Động"}
            </button>

            <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 ml-2">
              <span>Tốc độ:</span>
              <input
                type="range"
                min="1"
                max="5"
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(Number(e.target.value))}
                className="w-20 accent-blue-500 cursor-pointer"
              />
              <span className="w-4 font-mono font-bold">{scrollSpeed}x</span>
            </div>
          </div>

          {/* Font Size Controls */}
          <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 px-1">Cỡ chữ:</span>
            <button
              onClick={() => setFontSize((prev) => Math.max(18, prev - 4))}
              className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center transition-colors"
            >
              A-
            </button>
            <span className="font-mono text-sm px-1 text-zinc-800 dark:text-zinc-200 font-bold">{fontSize}px</span>
            <button
              onClick={() => setFontSize((prev) => Math.min(48, prev + 4))}
              className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-bold text-zinc-800 dark:text-zinc-200 flex items-center justify-center transition-colors"
            >
              A+
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-red-600/80 text-zinc-700 dark:text-zinc-300 hover:text-white transition-colors"
            title="Đóng máy đọc"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Teleprompter Content Canvas */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 sm:px-20 md:px-32 py-12 scroll-smooth"
      >
        <div className="max-w-4xl mx-auto space-y-8">
          <ReactMarkdown
            components={{
              strong: ({ children }) => {
                const textStr = String(children);
                const isChar1 = char1Name && textStr.toLowerCase().includes(char1Name.toLowerCase());
                const isChar2 = char2Name && textStr.toLowerCase().includes(char2Name.toLowerCase());

                return (
                  <strong
                    className={`inline-block px-4 py-1.5 rounded-2xl font-extrabold mr-2 shadow-lg mb-2 ${
                      isChar1
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white border border-cyan-400/40"
                        : isChar2
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border border-pink-400/40"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {children}
                  </strong>
                );
              },
              p: ({ children }) => (
                <p
                  style={{ fontSize: `${fontSize}px` }}
                  className="leading-relaxed text-zinc-800 dark:text-zinc-200 mb-8 font-medium tracking-wide border-l-2 border-zinc-200 dark:border-zinc-800 pl-4 py-1"
                >
                  {children}
                </p>
              ),
              h2: ({ children }) => (
                <div className="my-10 p-5 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/60 border-l-4 border-indigo-600 dark:border-indigo-400 shadow-md">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 m-0 tracking-tight">
                    {children}
                  </h2>
                </div>
              ),
              h3: ({ children }) => (
                <div className="my-8 p-4 rounded-xl bg-purple-50/90 dark:bg-purple-950/60 border-l-4 border-purple-500 shadow-md">
                  <h3 className="text-lg sm:text-xl font-bold text-purple-700 dark:text-purple-300 m-0">
                    {children}
                  </h3>
                </div>
              ),
            }}
          >
            {formattedText}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
