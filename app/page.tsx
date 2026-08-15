"use client";

import { useState, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";
import TeleprompterModal from "./components/TeleprompterModal";
import Toast from "./components/Toast";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [char1Name, setChar1Name] = useState("Minh");
  const [char1Pronoun, setChar1Pronoun] = useState("Anh");
  const [char1Voice, setChar1Voice] = useState<"male" | "female">("male");
  const [char2Name, setChar2Name] = useState("Linh");
  const [char2Pronoun, setChar2Pronoun] = useState("Em");
  const [char2Voice, setChar2Voice] = useState<"male" | "female">("female");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedScript, setGeneratedScript] = useState("");
  const [shareId, setShareId] = useState("");
  const [error, setError] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<"ALL" | "CHAR1" | "CHAR2">("ALL");
  const [isTeleprompterOpen, setIsTeleprompterOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [toastMessage, setToastMessage] = useState("");
  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiGuide, setShowApiGuide] = useState(false);
  const [keyValidStatus, setKeyValidStatus] = useState<"idle" | "checking" | "valid" | "invalid" | "warning">("idle");
  const [keyValidMsg, setKeyValidMsg] = useState("");
  const hasApiKey = apiKey.trim().length > 0;

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    // Check current theme state
    const isDarkModeActive = document.documentElement.classList.contains("dark");
    setIsDark(isDarkModeActive);
    // Load saved API key from localStorage
    const savedKey = localStorage.getItem("gemini_api_key") || "";
    setApiKey(savedKey);
  }, []);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem("gemini_api_key", value);
    // Reset validation when key changes
    setKeyValidStatus("idle");
    setKeyValidMsg("");
  };

  const handleClearApiKey = () => {
    setApiKey("");
    localStorage.removeItem("gemini_api_key");
    setKeyValidStatus("idle");
    setKeyValidMsg("");
    showToast("Đã xoá API Key.");
  };

  const handleValidateKey = async () => {
    if (!hasApiKey) return;
    setKeyValidStatus("checking");
    setKeyValidMsg("");
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setKeyValidStatus("valid");
        setKeyValidMsg(data.message || "API Key h\u1ee3p l\u1ec7!");
      } else if (res.status === 503) {
        // Server busy — cannot confirm but also cannot deny
        setKeyValidStatus("warning" as any);
        setKeyValidMsg(data.message || "M\u00e1y ch\u1ee7 \u0111ang b\u1eadn, kh\u00f4ng th\u1ec3 x\u00e1c nh\u1eadn.");
      } else {
        setKeyValidStatus("invalid");
        setKeyValidMsg(data.message || "API Key kh\u00f4ng h\u1ee3p l\u1ec7.");
      }
    } catch {
      setKeyValidStatus("invalid");
      setKeyValidMsg("Kh\u00f4ng th\u1ec3 k\u1ebft n\u1ed1i \u0111\u1ec3 ki\u1ec3m tra. Vui l\u00f2ng th\u1eed l\u1ea1i.");
    }
  };


  const toggleTheme = () => {
    if (document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  };

  const samplePrompts = [
    {
      label: "💻 Sinh viên tư vấn mua Laptop (45 phút)",
      prompt: "Một bạn sinh viên năm nhất chuyên ngành CNTT đang nhờ nhân viên cửa hàng tư vấn chọn mua laptop học lập trình, ngân sách khoảng 20 triệu.",
      duration: "45",
      char1Name: "Tuấn",
      char1Pronoun: "Em",
      char2Name: "Minh",
      char2Pronoun: "Anh",
    },
    {
      label: "💼 Phỏng vấn tuyển dụng AI Engineer",
      prompt: "Buổi phỏng vấn giữa nhà tuyển dụng Tech Lead và ứng viên vị trí AI Engineer về kinh nghiệm làm việc với Large Language Models và các dự án thực tế.",
      duration: "15",
      char1Name: "Nam",
      char1Pronoun: "Em",
      char2Name: "Hùng",
      char2Pronoun: "Anh",
    },
  ];

  const applySample = (sample: typeof samplePrompts[0]) => {
    setPrompt(sample.prompt);
    setDuration(sample.duration);
    setChar1Name(sample.char1Name);
    setChar1Pronoun(sample.char1Pronoun);
    setChar2Name(sample.char2Name);
    setChar2Pronoun(sample.char2Pronoun);
    // Reset voice defaults khi dùng mẫu
    setChar1Voice("male");
    setChar2Voice("female");
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setGeneratedScript("");
    setShareId("");
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const increment = prev < 50 ? 5 : prev < 85 ? 2 : prev < 95 ? 0.5 : 0;
        return Math.min(prev + increment, 98);
      });
    }, 500);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          duration,
          char1Name,
          char1Pronoun,
          char1Voice,
          char2Name,
          char2Pronoun,
          char2Voice,
          apiKey: apiKey.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đã xảy ra lỗi");
      }

      setProgress(100);
      setGeneratedScript(data.text);
      setShareId(data.shareId);
    } catch (err: any) {
      setProgress(0);
      setError(err.message || "Không thể kết nối với server");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setIsLoading(false), 400);
    }
  };

  // Stats calculation — 130 wpm matches the backend prompt instruction
  const WPM = 130;
  const scriptStats = useMemo(() => {
    if (!generatedScript) return { wordCount: 0, charCount: 0, estimatedMinutes: "0", estimatedMinutesNum: 0 };
    const cleanText = generatedScript.replace(/\*\*/g, "");
    const words = cleanText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const estimatedMinutesNum = wordCount / WPM;
    const estimatedMinutes = estimatedMinutesNum.toFixed(1);
    return { wordCount, charCount: cleanText.length, estimatedMinutes, estimatedMinutesNum };
  }, [generatedScript]);


  // Filter script by speaker
  const filteredScript = useMemo(() => {
    if (!generatedScript) return "";
    let formatted = generatedScript.replace(/\*\*/g, "");

    // Auto convert lines like "Phần 1: ..." or "Phân đoạn 1: ..." into ## Markdown headers
    formatted = formatted.replace(/(^|\n)(Phần \d+.*?|Phân đoạn \d+.*?|Chương \d+.*?)(?=\n|$)/gi, "$1\n## 📌 $2\n");
    formatted = formatted.replace(/(\[.*?\])/g, "**$1**");

    if (speakerFilter === "ALL") return formatted;

    const targetName = speakerFilter === "CHAR1" ? char1Name : char2Name;
    if (!targetName) return formatted;

    const lines = formatted.split("\n");
    const filteredLines = lines.filter((line) => {
      if (!line.includes("[")) return true;
      return line.toLowerCase().includes(`[${targetName.toLowerCase()}]`);
    });

    return filteredLines.join("\n");
  }, [generatedScript, speakerFilter, char1Name, char2Name]);

  const handleCopyLink = () => {
    if (shareId) {
      const url = `${window.location.origin}/share/${shareId}`;
      navigator.clipboard.writeText(url);
      showToast("Đã sao chép link chia sẻ thành công!");
    }
  };

  const handleCopyScript = () => {
    if (generatedScript) {
      const plainText = generatedScript.replace(/\*\*/g, "");
      navigator.clipboard.writeText(plainText);
      showToast("Đã sao chép toàn bộ nội dung kịch bản!");
    }
  };

  const handleDownloadTxt = () => {
    if (!generatedScript) return;
    const element = document.createElement("a");
    const file = new Blob([generatedScript.replace(/\*\*/g, "")], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `kich-ban-ai-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans flex flex-col transition-colors duration-300 selection:bg-blue-500 selection:text-white">
      {/* Studio Top Header Bar */}
      <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-xl shadow-lg shadow-blue-500/20">
            S
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">
                ScriptStudio<span className="text-blue-600 dark:text-blue-500">AI</span>
              </h1>
              <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
                CAO CẤP v2.5
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">Studio sáng tạo kịch bản hội thoại AI chuyên nghiệp</p>
          </div>
        </div>

        {/* Quick Action Stats & Controls */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all"
            title="Đổi giao diện Sáng / Tối"
          >
            {isDark ? "☀️ Sáng" : "🌙 Tối"}
          </button>

          {generatedScript && (
            <>
              <div className="hidden md:flex items-center gap-4 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 px-4 py-1.5 rounded-2xl text-xs">
                <div>
                  <span className="text-zinc-500 dark:text-zinc-400">Số từ: </span>
                  <span className="font-bold text-zinc-900 dark:text-white">{scriptStats.wordCount}</span>
                </div>
                <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700"></div>
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 dark:text-zinc-400">Thời lượng: </span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">~{scriptStats.estimatedMinutes} phút</span>
                  {(() => {
                    const selected = parseFloat(duration);
                    const actual = scriptStats.estimatedMinutesNum;
                    const diffSec = Math.abs(actual - selected) * 60;
                    if (diffSec <= 45) return <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-md">✓ Đúng</span>;
                    if (diffSec <= 90) return <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px] bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded-md">≈ Gần đúng</span>;
                    return <span className="text-red-500 dark:text-red-400 font-bold text-[10px] bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-md">✗ Lệch {Math.round(diffSec)}s</span>;
                  })()}
                </div>
              </div>

              <button
                onClick={() => setIsTeleprompterOpen(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-extrabold text-xs px-4 py-2 rounded-2xl shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <span>🎬</span> Máy Đọc Kịch Bản
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Studio Workspace Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Left Column: Form Sidebar (5 Cols) */}
        <div className="lg:col-span-5 p-6 sm:p-8 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-y-auto space-y-6 transition-colors">

          {/* ===== API KEY SECTION ===== */}
          <div className={`rounded-2xl border-2 transition-all ${
            keyValidStatus === "valid"
              ? "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20"
              : keyValidStatus === "invalid"
              ? "border-red-400/60 bg-red-50/60 dark:bg-red-950/20"
              : keyValidStatus === "warning"
              ? "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20"
              : hasApiKey
              ? "border-blue-400/40 bg-blue-50/40 dark:bg-blue-950/10"
              : "border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/20"
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex items-center justify-center w-8 h-8 rounded-xl text-base shadow-sm ${
                  keyValidStatus === "valid"
                    ? "bg-emerald-500 text-white"
                    : keyValidStatus === "invalid"
                    ? "bg-red-500 text-white"
                    : keyValidStatus === "warning"
                    ? "bg-amber-400 text-white"
                    : hasApiKey
                    ? "bg-blue-500 text-white"
                    : "bg-amber-400 text-white"
                }`}>
                  {keyValidStatus === "valid" ? "🔑" : keyValidStatus === "invalid" ? "🚫" : hasApiKey ? "🔑" : "🔒"}
                </div>
                <div>
                  <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">Gemini API Key</p>
                  <p className={`text-[10px] font-semibold ${
                    keyValidStatus === "valid"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : keyValidStatus === "invalid"
                      ? "text-red-500 dark:text-red-400"
                      : keyValidStatus === "warning"
                      ? "text-amber-600 dark:text-amber-400"
                      : hasApiKey
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {keyValidStatus === "valid"
                      ? "✅ Key hợp lệ — Sẵn sàng tạo kịch bản"
                      : keyValidStatus === "invalid"
                      ? "❌ Key không hợp lệ"
                      : keyValidStatus === "warning"
                      ? "⚠️ Máy chủ bận — Chưa xác nhận được"
                      : hasApiKey
                      ? "🔑 Đã nhập key — Nhấn Kiểm tra để xác nhận"
                      : "⚠️ Bắt buộc nhập để sử dụng"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiGuide((v) => !v)}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/70 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
              >
                {showApiGuide ? "✕ Đóng" : "❓ Cách lấy key"}
              </button>
            </div>

            {/* Input Row */}
            <div className="px-4 pb-4 space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="gemini-api-key-input"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Dán API Key của bạn vào đây... (AIza...)"
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-mono pr-10 focus:outline-none focus:ring-2 transition-all bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 ${
                      hasApiKey
                        ? "border-emerald-400/60 focus:ring-emerald-500/30"
                        : "border-amber-400/60 focus:ring-amber-400/30"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                    title={showApiKey ? "Ẩn key" : "Hiện key"}
                  >
                    {showApiKey ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                {hasApiKey && (
                  <button
                    type="button"
                    onClick={handleValidateKey}
                    disabled={keyValidStatus === "checking"}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                      keyValidStatus === "valid"
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400/60 text-emerald-600 dark:text-emerald-400"
                        : keyValidStatus === "invalid"
                        ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700/60 text-red-500 hover:bg-red-100"
                        : keyValidStatus === "warning"
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 hover:bg-amber-100"
                        : "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    } disabled:opacity-60 disabled:cursor-wait`}
                    title="Kiểm tra API Key"
                  >
                    {keyValidStatus === "checking" ? (
                      <>
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Đang kiểm tra...
                      </>
                    ) : keyValidStatus === "valid" ? (
                      <>✅ Hợp lệ</>
                    ) : keyValidStatus === "invalid" ? (
                      <>❌ Thử lại</>
                    ) : keyValidStatus === "warning" ? (
                      <>⚠️ Thử lại</>
                    ) : (
                      <>🔌 Kiểm tra kết nối</>
                    )}
                  </button>
                )}
                {hasApiKey && (
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="px-3 py-2 rounded-xl border border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold transition-all"
                    title="Xoá API Key"
                  >
                    🗑
                  </button>
                )}
              </div>

              {/* Validation result message */}
              {keyValidMsg && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold ${
                  keyValidStatus === "valid"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/40"
                    : keyValidStatus === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-300/60 dark:border-amber-700/40"
                    : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-300/60 dark:border-red-700/40"
                }`}>
                  <span>{keyValidStatus === "valid" ? "✅" : keyValidStatus === "warning" ? "⚠️" : "❌"}</span>
                  <span>{keyValidMsg}</span>
                </div>
              )}

              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                🔐 Key được lưu ngay trên trình duyệt của bạn, không gửi đến bất kỳ máy chủ nào khác.
              </p>
            </div>

            {/* Collapsible Guide */}
            {showApiGuide && (
              <div className="mx-4 mb-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5">
                  <p className="text-xs font-extrabold text-white">📖 Hướng dẫn lấy Gemini API Key (miễn phí)</p>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    {[
                      { step: "1", icon: "🌐", text: "Truy cập", link: { url: "https://aistudio.google.com/app/apikey", label: "aistudio.google.com" } },
                      { step: "2", icon: "👤", text: "Đăng nhập tài khoản Google của bạn" },
                      { step: "3", icon: "➕", text: 'Nhấn nút "Create API key" màu xanh' },
                      { step: "4", icon: "📋", text: "Copy API key (bắt đầu bằng \"AIza...\")" },
                      { step: "5", icon: "✅", text: "Dán vào ô nhập key ở trên là xong!" },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center mt-0.5">{item.step}</span>
                        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                          <span className="mr-1">{item.icon}</span>
                          {item.text}
                          {item.link && (
                            <>
                              {" "}
                              <a
                                href={item.link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 font-bold underline hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                {item.link.label}
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition-all"
                    >
                      🚀 Mở Google AI Studio
                    </a>
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center">
                    Gemini API miễn phí với hạn mức cao — đủ dùng thoải mái.
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* ===== END API KEY SECTION ===== */}

          {/* Sample Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <span>💡</span> Mẫu gợi ý nhanh
            </label>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applySample(s)}
                  className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl transition-all text-left truncate max-w-full hover:text-zinc-900 dark:hover:text-white"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-6">
            {/* Prompt input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-900 dark:text-zinc-200">
                  Thông tin & Ý tưởng kịch bản <span className="text-blue-500">*</span>
                </label>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{prompt.length} ký tự</span>
              </div>
              <textarea
                required
                rows={6}
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none shadow-inner"
                placeholder="Dán toàn bộ bối cảnh, chủ đề, yêu cầu thảo luận vào đây..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Duration slider / input */}
            <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/80 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  ⏱ Thời lượng ước tính (Phút)
                </label>
                <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-lg">
                  {duration} Phút
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                <span>1 phút (Ngắn)</span>
                <span>15 phút (Trung bình)</span>
                <span>45-60 phút (Dài)</span>
              </div>
            </div>

            {/* Characters section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Character 1 Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-zinc-900 border border-blue-200 dark:border-blue-800/40 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                    Nhân vật 1
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-sm shadow-cyan-400/50"></div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Tên nhân vật</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700/70 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
                    placeholder="VD: Minh"
                    value={char1Name}
                    onChange={(e) => setChar1Name(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Cách xưng hô</label>
                  <select
                    required
                    className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700/70 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:border-blue-500 focus:outline-none cursor-pointer"
                    value={char1Pronoun}
                    onChange={(e) => setChar1Pronoun(e.target.value)}
                  >
                    <option value="" disabled>-- Chọn --</option>
                    <option value="Tôi">Tôi</option>
                    <option value="Tui">Tui</option>
                    <option value="Mình">Mình</option>
                    <option value="Tớ">Tớ</option>
                    <option value="Anh">Anh</option>
                    <option value="Chị">Chị</option>
                    <option value="Em">Em</option>
                    <option value="Ông">Ông</option>
                    <option value="Bà">Bà</option>
                    <option value="Cháu">Cháu</option>
                    <option value="Cô">Cô</option>
                    <option value="Chú">Chú</option>
                    <option value="Bác">Bác</option>
                    <option value="Bạn">Bạn</option>
                    <option value="Cậu">Cậu</option>
                    <option value="Mày">Mày</option>
                    <option value="Tao">Tao</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">🎙 Giọng đọc</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChar1Voice("male")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        char1Voice === "male"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30"
                          : "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700/70 text-zinc-500 dark:text-zinc-400 hover:border-blue-400"
                      }`}
                    >
                      👨 Nam
                    </button>
                    <button
                      type="button"
                      onClick={() => setChar1Voice("female")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        char1Voice === "female"
                          ? "bg-pink-500 text-white border-pink-400 shadow-sm shadow-pink-500/30"
                          : "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700/70 text-zinc-500 dark:text-zinc-400 hover:border-pink-400"
                      }`}
                    >
                      👩 Nữ
                    </button>
                  </div>
                </div>
              </div>

              {/* Character 2 Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/30 dark:to-zinc-900 border border-purple-200 dark:border-purple-800/40 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                    Nhân vật 2
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-pink-500 dark:bg-pink-400 shadow-sm shadow-pink-400/50"></div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Tên nhân vật</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700/70 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
                    placeholder="VD: Linh"
                    value={char2Name}
                    onChange={(e) => setChar2Name(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">Cách xưng hô</label>
                  <select
                    required
                    className="w-full bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-700/70 rounded-xl px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:border-purple-500 focus:outline-none cursor-pointer"
                    value={char2Pronoun}
                    onChange={(e) => setChar2Pronoun(e.target.value)}
                  >
                    <option value="" disabled>-- Chọn --</option>
                    <option value="Tôi">Tôi</option>
                    <option value="Tui">Tui</option>
                    <option value="Mình">Mình</option>
                    <option value="Tớ">Tớ</option>
                    <option value="Anh">Anh</option>
                    <option value="Chị">Chị</option>
                    <option value="Em">Em</option>
                    <option value="Ông">Ông</option>
                    <option value="Bà">Bà</option>
                    <option value="Cháu">Cháu</option>
                    <option value="Cô">Cô</option>
                    <option value="Chú">Chú</option>
                    <option value="Bác">Bác</option>
                    <option value="Bạn">Bạn</option>
                    <option value="Cậu">Cậu</option>
                    <option value="Mày">Mày</option>
                    <option value="Tao">Tao</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">🎙 Giọng đọc</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setChar2Voice("male")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        char2Voice === "male"
                          ? "bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30"
                          : "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700/70 text-zinc-500 dark:text-zinc-400 hover:border-blue-400"
                      }`}
                    >
                      👨 Nam
                    </button>
                    <button
                      type="button"
                      onClick={() => setChar2Voice("female")}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        char2Voice === "female"
                          ? "bg-pink-500 text-white border-pink-400 shadow-sm shadow-pink-500/30"
                          : "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-700/70 text-zinc-500 dark:text-zinc-400 hover:border-pink-400"
                      }`}
                    >
                      👩 Nữ
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            {!hasApiKey && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60">
                <span className="text-base">🔑</span>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  Vui lòng nhập <strong>Gemini API Key</strong> ở trên để bắt đầu tạo kịch bản.
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={isLoading || !hasApiKey}
              className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-4 font-extrabold text-white shadow-xl shadow-blue-600/25 hover:shadow-blue-600/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading && (
                <div
                  className="absolute inset-0 bg-white/30 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%`, left: 0 }}
                ></div>
              )}
              <span className="relative z-10 flex items-center justify-center gap-2 text-sm">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang sáng tạo kịch bản... {Math.floor(progress)}%
                  </>
                ) : (
                  <>
                    <span>⚡️</span> Khởi Tạo Kịch Bản AI
                  </>
                )}
              </span>
            </button>
          </form>
        </div>

        {/* Right Column: Main Script Canvas (7 Cols) */}
        <div className="lg:col-span-7 bg-zinc-50 dark:bg-zinc-950 p-6 sm:p-10 flex flex-col justify-between min-h-[600px] transition-colors">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
              <span>⚠️</span> {error}
            </div>
          )}

          {!generatedScript && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-3xl shadow-sm">
                ✍️
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200">Chưa có kịch bản nào được tạo</h3>
                <p className="text-xs text-zinc-500">
                  Hãy điền bối cảnh và bấm nút <strong className="text-blue-600 dark:text-blue-400">Khởi Tạo Kịch Bản AI</strong> để nhận kết quả dạng hội thoại chuẩn Studio.
                </p>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 my-auto">
              <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-3xl animate-pulse">
                🤖
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">AI đang viết kịch bản hội thoại...</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Đang phân tích tâm lý nhân vật và mở rộng hội thoại ({Math.floor(progress)}%)</p>
              </div>
            </div>
          )}

          {generatedScript && !isLoading && (
            <div className="flex-1 flex flex-col space-y-6 animate-in fade-in duration-500">
              {/* Studio Canvas Header Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                {/* Speaker Filters */}
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs shadow-sm">
                  <button
                    onClick={() => setSpeakerFilter("ALL")}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                      speakerFilter === "ALL"
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    Tất Cả
                  </button>
                  {char1Name && (
                    <button
                      onClick={() => setSpeakerFilter("CHAR1")}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        speakerFilter === "CHAR1"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      👤 {char1Name}
                    </button>
                  )}
                  {char2Name && (
                    <button
                      onClick={() => setSpeakerFilter("CHAR2")}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        speakerFilter === "CHAR2"
                          ? "bg-purple-600 text-white shadow-sm"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      👥 {char2Name}
                    </button>
                  )}
                </div>

                {/* Export & Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyScript}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all shadow-sm"
                  >
                    📋 Copy Nội Dung
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all shadow-sm"
                  >
                    💾 Tải Về (.txt)
                  </button>

                  {shareId && (
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600/30 border border-blue-200 dark:border-blue-500/30 text-xs font-bold text-blue-700 dark:text-blue-400 transition-all"
                    >
                      🔗 Sao Chép Link
                    </button>
                  )}
                </div>
              </div>

              {/* Markdown Display Panel */}
              <div className="flex-1 overflow-y-auto max-h-[700px] pr-2 prose prose-zinc dark:prose-invert max-w-none">
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
                      <p className="mb-6 leading-relaxed text-zinc-800 dark:text-zinc-300 text-base border-l-2 border-zinc-200 dark:border-zinc-800 pl-4 py-1 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors">
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
          )}
        </div>
      </div>

      {/* Toast Notification with Progress Bar */}
      <Toast message={toastMessage} onClose={() => setToastMessage("")} />

      {/* Teleprompter Modal Component */}
      <TeleprompterModal
        isOpen={isTeleprompterOpen}
        onClose={() => setIsTeleprompterOpen(false)}
        scriptText={generatedScript}
        char1Name={char1Name}
        char2Name={char2Name}
      />
    </div>
  );
}
