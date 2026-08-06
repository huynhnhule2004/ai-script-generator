"use client";

import { useState, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import TeleprompterModal from "../../components/TeleprompterModal";
import Toast from "../../components/Toast";

interface ShareDetailClientProps {
  script: string;
  id: string;
}

export default function ShareDetailClient({ script, id }: ShareDetailClientProps) {
  const [speakerFilter, setSpeakerFilter] = useState<"ALL" | string>("ALL");
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    // Check current theme state
    const isDarkModeActive = document.documentElement.classList.contains("dark");
    setIsDark(isDarkModeActive);
  }, []);

  const toggleTheme = () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  // Detect speaker names automatically from the script (e.g., [Vương], [Như])
  const detectedSpeakers = useMemo(() => {
    const matches = script.match(/\[(.*?)\]/g);
    if (!matches) return [];
    const unique = Array.from(new Set(matches.map((m) => m.replace(/\[|\]/g, "").trim())));
    return unique.filter((name) => name.length > 0 && name.length < 20);
  }, [script]);

  const char1Name = detectedSpeakers[0] || "";
  const char2Name = detectedSpeakers[1] || "";

  // Calculate script stats
  const scriptStats = useMemo(() => {
    const cleanText = script.replace(/\*\*/g, "");
    const words = cleanText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const estimatedMinutes = (wordCount / 140).toFixed(1);
    return { wordCount, estimatedMinutes };
  }, [script]);

  // Filter script by speaker
  const filteredScript = useMemo(() => {
    let formatted = script.replace(/\*\*/g, "");

    // Auto convert lines like "Phần 1: ..." or "Phân đoạn 1: ..." into ## Markdown headers
    formatted = formatted.replace(/(^|\n)(Phần \d+.*?|Phân đoạn \d+.*?|Chương \d+.*?)(?=\n|$)/gi, "$1\n## 📌 $2\n");
    formatted = formatted.replace(/(\[.*?\])/g, "**$1**");

    if (speakerFilter === "ALL") return formatted;

    const lines = formatted.split("\n");
    const filteredLines = lines.filter((line) => {
      if (!line.includes("[")) return true;
      return line.toLowerCase().includes(`[${speakerFilter.toLowerCase()}]`);
    });

    return filteredLines.join("\n");
  }, [script, speakerFilter]);

  const handleCopyScript = () => {
    const plainText = script.replace(/\*\*/g, "");
    navigator.clipboard.writeText(plainText);
    showToast("Đã sao chép toàn bộ nội dung kịch bản!");
  };

  const handleDownloadTxt = () => {
    const element = document.createElement("a");
    const file = new Blob([script.replace(/\*\*/g, "")], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `kich-ban-chia-se-${id.slice(0, 8)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col transition-colors duration-300 selection:bg-blue-500 selection:text-white">
      {/* Studio Header Bar */}
      <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-lg shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              S
            </div>
            <span className="font-extrabold text-base text-zinc-900 dark:text-white">
              ScriptStudio<span className="text-blue-600 dark:text-blue-500">AI</span>
            </span>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
            📄 Trang Chi Tiết Kịch Bản
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Quick Stats */}
          <div className="hidden md:flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 px-4 py-1.5 rounded-2xl text-xs">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Số từ: </span>
              <span className="font-bold text-zinc-900 dark:text-white">{scriptStats.wordCount}</span>
            </div>
            <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">Thời gian đọc: </span>
              <span className="font-bold text-blue-600 dark:text-blue-400">~{scriptStats.estimatedMinutes} phút</span>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all"
            title="Đổi giao diện Sáng / Tối"
          >
            {isDark ? "☀️ Sáng" : "🌙 Tối"}
          </button>

          {/* Teleprompter */}
          <button
            onClick={() => setIsTeleprompterOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs px-4 py-2 rounded-2xl shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <span>🎬</span> Máy Đọc Kịch Bản
          </button>

          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-2xl shadow-lg shadow-blue-600/20 transition-all"
          >
            <span>⚡️</span> Tạo Mới
          </Link>
        </div>
      </header>

      {/* Main Studio Detail Canvas */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex-1">
        <div className="bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 backdrop-blur-xl transition-colors">
          {/* Canvas Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            {/* Speakers Filters */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-1">Lọc vai đọc:</span>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-700/80 text-xs">
                <button
                  onClick={() => setSpeakerFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    speakerFilter === "ALL"
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  Tất Cả
                </button>
                {detectedSpeakers.map((speaker, idx) => (
                  <button
                    key={speaker}
                    onClick={() => setSpeakerFilter(speaker)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      speakerFilter === speaker
                        ? idx === 0
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-purple-600 text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    {idx === 0 ? "👤" : "👥"} {speaker}
                  </button>
                ))}
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyScript}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all shadow-sm"
              >
                📋 Copy Nội Dung
              </button>

              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 transition-all shadow-sm"
              >
                💾 Tải Về (.txt)
              </button>
            </div>
          </div>

          {/* Markdown Content Viewer */}
          <div className="prose prose-zinc dark:prose-invert max-w-none py-2">
            <ReactMarkdown
              components={{
                strong: ({ children }) => {
                  const textStr = String(children);
                  const isChar1 = char1Name && textStr.toLowerCase().includes(char1Name.toLowerCase());
                  const isChar2 = char2Name && textStr.toLowerCase().includes(char2Name.toLowerCase());

                  return (
                    <strong
                      className={`inline-block px-3 py-1 rounded-xl font-extrabold mr-2 shadow-sm text-sm border ${
                        isChar1
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-cyan-400/40"
                          : isChar2
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-400/40"
                          : "bg-blue-600 text-white border-blue-400/40"
                      }`}
                    >
                      {children}
                    </strong>
                  );
                },
                p: ({ children }) => (
                  <p className="mb-6 leading-relaxed text-zinc-800 dark:text-zinc-300 text-base sm:text-lg border-l-2 border-zinc-200 dark:border-zinc-800 pl-4 py-1 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors">
                    {children}
                  </p>
                ),
                h2: ({ children }) => (
                  <div className="my-8 p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border-l-4 border-indigo-600 dark:border-indigo-400 shadow-sm">
                    <h2 className="text-lg sm:text-xl font-extrabold text-indigo-700 dark:text-indigo-300 m-0 tracking-tight">
                      {children}
                    </h2>
                  </div>
                ),
                h3: ({ children }) => (
                  <div className="my-6 p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border-l-4 border-purple-500 shadow-sm">
                    <h3 className="text-base sm:text-lg font-bold text-purple-700 dark:text-purple-300 m-0">
                      {children}
                    </h3>
                  </div>
                ),
              }}
            >
              {filteredScript}
            </ReactMarkdown>
          </div>
        </div>
      </main>

      {/* Toast Notification with Progress Bar */}
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />

      {/* Teleprompter Modal */}
      <TeleprompterModal
        isOpen={isTeleprompterOpen}
        onClose={() => setIsTeleprompterOpen(false)}
        scriptText={script}
        char1Name={char1Name}
        char2Name={char2Name}
      />
    </div>
  );
}
