"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Toast from "../components/Toast";

type SessionType = "thuong" | "checkpoint" | "sanpham";

/** One student's row in the individual-comment table */
type StudentRow = { id: number; name: string; note: string; progress: string };

const emptyRow = (id: number): StudentRow => ({ id, name: "", note: "", progress: "" });

const SESSION_TYPES: { id: SessionType; icon: string; label: string; desc: string }[] = [
  { id: "thuong", icon: "📚", label: "Buổi học thường", desc: "Dạy kiến thức mới + thực hành" },
  { id: "checkpoint", icon: "📝", label: "Buổi Checkpoint", desc: "Kiểm tra định kỳ, nhận xét gọn" },
  { id: "sanpham", icon: "🏆", label: "Sản phẩm cuối khóa", desc: "Làm dự án, có tiến độ %" },
];

/** Form values that are worth remembering between sessions */
const PROFILE_KEY = "mindx_feedback_profile";
const PROFILE_FIELDS = [
  "teacherName",
  "teacherRole",
  "courseName",
  "className",
  "linkDenise",
  "linkDocs",
  "linkVideo",
  "linkFolder",
] as const;

const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// yyyy-mm-dd (giá trị của input type="date") -> dd/mm/yyyy
const formatDateVN = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso.trim();
};

export default function NhanXetPage() {
  const [sessionType, setSessionType] = useState<SessionType>("thuong");
  const [teacherName, setTeacherName] = useState("");
  const [teacherRole, setTeacherRole] = useState("giáo viên");
  const [courseName, setCourseName] = useState("");
  const [className, setClassName] = useState("");
  const [sessionNumber, setSessionNumber] = useState("");
  const [sessionDate, setSessionDate] = useState(""); // điền sau khi mount, tránh lệch múi giờ server/client
  const [topic, setTopic] = useState("");
  const [content, setContent] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([emptyRow(0), emptyRow(1), emptyRow(2)]);
  const [homework, setHomework] = useState("");
  const [nextSession, setNextSession] = useState("");
  const [linkDenise, setLinkDenise] = useState("https://denise.mindx.edu.vn/");
  const [linkDocs, setLinkDocs] = useState("");
  const [linkVideo, setLinkVideo] = useState("");
  const [linkFolder, setLinkFolder] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const hasApiKey = apiKey.trim().length > 0;
  const showToast = (msg: string) => setToastMessage(msg);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setSessionDate(todayISO());
    setApiKey(localStorage.getItem("gemini_api_key") || "");
    try {
      const saved: Partial<Record<(typeof PROFILE_FIELDS)[number], string>> = JSON.parse(
        localStorage.getItem(PROFILE_KEY) || "{}"
      );
      if (saved.teacherName) setTeacherName(saved.teacherName);
      if (saved.teacherRole) setTeacherRole(saved.teacherRole);
      if (saved.courseName) setCourseName(saved.courseName);
      if (saved.className) setClassName(saved.className);
      if (saved.linkDenise) setLinkDenise(saved.linkDenise);
      if (saved.linkDocs) setLinkDocs(saved.linkDocs);
      if (saved.linkVideo) setLinkVideo(saved.linkVideo);
      if (saved.linkFolder) setLinkFolder(saved.linkFolder);
    } catch {
      // corrupted profile — ignore and start fresh
    }
  }, []);

  const saveProfile = () => {
    const profile = {
      teacherName,
      teacherRole,
      courseName,
      className,
      linkDenise,
      linkDocs,
      linkVideo,
      linkFolder,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    showToast("Đã lưu thông tin lớp — lần sau không cần nhập lại.");
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem("gemini_api_key", value);
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  };

  const nextRowId = useRef(3);

  const filledStudents = useMemo(() => students.filter((s) => s.name.trim()), [students]);
  const studentCount = filledStudents.length;

  // Serialize the table back into the one-line-per-student format the API prompt expects
  const studentNotes = useMemo(
    () =>
      filledStudents
        .map((s) => {
          const detail = [s.note.trim(), s.progress.trim() && `tiến độ ${s.progress.trim()}%`]
            .filter(Boolean)
            .join(", ");
          return detail ? `${s.name.trim()} - ${detail}` : s.name.trim();
        })
        .join("\n"),
    [filledStudents]
  );

  const addStudentRow = () => {
    const row = emptyRow(nextRowId.current++);
    setStudents((rows) => [...rows, row]);
  };

  const removeStudentRow = (id: number) => {
    const fallback = emptyRow(nextRowId.current++);
    setStudents((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : [fallback]));
  };

  const updateStudentRow = (id: number, field: keyof Omit<StudentRow, "id">, value: string) =>
    setStudents((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const isReady =
    hasApiKey &&
    teacherName.trim() &&
    courseName.trim() &&
    sessionNumber.trim() &&
    sessionDate.trim() &&
    topic.trim();

  const handleGenerate = async () => {
    if (!isReady || isLoading) return;
    setIsLoading(true);
    setError("");
    setOutput("");
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((p) => (p >= 90 ? 90 : p + Math.random() * 8));
    }, 400);

    try {
      const response = await fetch("/api/nhan-xet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          sessionType,
          teacherName,
          teacherRole,
          courseName,
          className,
          sessionNumber,
          sessionDate: formatDateVN(sessionDate),
          topic,
          content,
          generalNote,
          studentNotes,
          homework,
          nextSession,
          linkDenise,
          linkDocs,
          linkVideo,
          linkFolder,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Đã xảy ra lỗi");

      setProgress(100);
      setOutput(data.text);
    } catch (err) {
      setProgress(0);
      setError(err instanceof Error ? err.message : "Không thể kết nối với server");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setIsLoading(false), 400);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    showToast("Đã copy bản nhận xét — dán thẳng vào Zalo hoặc Email nhé!");
  };

  const inputClass =
    "w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all";
  const labelClass = "block text-xs font-extrabold text-zinc-600 dark:text-zinc-300 mb-1.5";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-zinc-950 transition-colors">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 backdrop-blur sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-lg shadow-lg shadow-indigo-500/25">
            🎓
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
              Nhận Xét Buổi Học MindX
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Ghi chú ngắn → bản nhận xét hoàn chỉnh gửi phụ huynh
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-xs font-bold px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
          >
            🎬 Tạo kịch bản
          </Link>
          <button
            onClick={toggleTheme}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
          >
            {isDark ? "☀️ Sáng" : "🌙 Tối"}
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* ===== LEFT: FORM ===== */}
        <div className="lg:col-span-5 p-6 sm:p-8 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-6 overflow-y-auto">
          {/* API KEY */}
          <div
            className={`rounded-2xl border-2 p-4 transition-all ${
              hasApiKey
                ? "border-emerald-400/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span>{hasApiKey ? "🔑" : "🔒"}</span>
              <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100">Gemini API Key</p>
              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                (dùng chung với trang tạo kịch bản)
              </span>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                placeholder="Dán API Key của bạn vào đây... (AIza...)"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                className={`${inputClass} font-mono text-xs pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                {showApiKey ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </div>

          {/* SESSION TYPE */}
          <div>
            <label className={labelClass}>① Loại buổi học</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSessionType(t.id)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    sessionType === t.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700"
                  }`}
                >
                  <div className="text-lg leading-none mb-1">{t.icon}</div>
                  <div
                    className={`text-xs font-extrabold ${
                      sessionType === t.id
                        ? "text-indigo-700 dark:text-indigo-300"
                        : "text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {t.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* TEACHER + CLASS */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className={`${labelClass} mb-0`}>② Giáo viên &amp; lớp học</label>
              <button
                type="button"
                onClick={saveProfile}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition-all"
              >
                💾 Lưu thông tin lớp
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Tên giáo viên *</label>
                <input
                  className={inputClass}
                  placeholder="Huỳnh Như"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Vai trò</label>
                <select
                  className={inputClass}
                  value={teacherRole}
                  onChange={(e) => setTeacherRole(e.target.value)}
                >
                  <option value="giáo viên">giáo viên</option>
                  <option value="giáo viên trợ giảng">giáo viên trợ giảng</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Khóa học *</label>
                <input
                  className={inputClass}
                  placeholder="Scratch Advance Online"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Mã lớp (nếu có)</label>
                <input
                  className={inputClass}
                  placeholder="SA19"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Buổi số *</label>
                <input
                  className={inputClass}
                  placeholder="11"
                  value={sessionNumber}
                  onChange={(e) => setSessionNumber(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Ngày học</label>
                <input
                  type="date"
                  className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`}
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* SESSION CONTENT */}
          <div className="space-y-3">
            <div>
              <label className={labelClass}>③ Chủ đề buổi học *</label>
              <input
                className={inputClass}
                placeholder="Dự án của em (Phần 2)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>④ Nội dung buổi học (ghi vắn tắt, mỗi ý một dòng)</label>
              <textarea
                className={`${inputClass} min-h-[90px] resize-y`}
                placeholder={"tìm hiểu clone trong scratch\nthực hành hiệu ứng bóng bay\nlàm game bảo vệ khủng long"}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>⑤ Nhận xét chung về lớp (ghi vắn tắt)</label>
              <textarea
                className={`${inputClass} min-h-[70px] resize-y`}
                placeholder="cả lớp tập trung, bám sát kịch bản. vài bạn còn yếu thao tác lưu/tải file"
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>
                ⑥ Nhận xét cá nhân{" "}
                {studentCount > 0 && (
                  <span className="text-indigo-600 dark:text-indigo-400">({studentCount} học sinh)</span>
                )}
              </label>

              <div className="space-y-2">
                {students.map((row, index) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/50 p-2.5 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[11px] font-extrabold">
                        {index + 1}
                      </span>
                      <input
                        className={`${inputClass} flex-1`}
                        placeholder="Họ tên đầy đủ (VD: Nguyễn Hoàng Trung Kiên)"
                        value={row.name}
                        onChange={(e) => updateStudentRow(row.id, "name", e.target.value)}
                      />
                      {sessionType === "sanpham" && (
                        <div className="relative w-20 shrink-0">
                          <input
                            className={`${inputClass} pr-6 text-center`}
                            placeholder="95"
                            inputMode="numeric"
                            value={row.progress}
                            onChange={(e) =>
                              updateStudentRow(row.id, "progress", e.target.value.replace(/[^0-9]/g, ""))
                            }
                            title="Tiến độ dự án (%)"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeStudentRow(row.id)}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/60 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
                        title="Xoá học sinh này"
                      >
                        🗑
                      </button>
                    </div>
                    <input
                      className={`${inputClass} text-xs`}
                      placeholder="Ghi chú: điểm mạnh, điểm cần cải thiện, lý do nếu chậm..."
                      value={row.note}
                      onChange={(e) => updateStudentRow(row.id, "note", e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addStudentRow}
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 text-xs font-extrabold hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all"
              >
                ➕ Thêm học sinh
              </button>

              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                Bỏ trống hết ô họ tên nếu chỉ muốn dùng câu &ldquo;xem chi tiết trên Compass&rdquo;.
                {sessionType === "sanpham" && " Ô % là tiến độ dự án của từng con."}
              </p>
            </div>
            <div>
              <label className={labelClass}>⑦ Dặn dò / bài tập về nhà (ghi vắn tắt)</label>
              <textarea
                className={`${inputClass} min-h-[70px] resize-y`}
                placeholder="hoàn thiện dự án, chuẩn bị sản phẩm để buổi sau làm slide"
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>⑧ Buổi sau học gì (giúp AI viết lời dặn dò khớp mốc)</label>
              <input
                className={inputClass}
                placeholder="làm slide thuyết trình"
                value={nextSession}
                onChange={(e) => setNextSession(e.target.value)}
              />
            </div>
          </div>

          {/* LINKS */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <label className={labelClass}>⑨ Đường dẫn đính kèm</label>
            <input
              className={inputClass}
              placeholder="Link Denise"
              value={linkDenise}
              onChange={(e) => setLinkDenise(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Tài liệu môn học"
              value={linkDocs}
              onChange={(e) => setLinkDocs(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Video bài học (bỏ trống nếu buổi này không có)"
              value={linkVideo}
              onChange={(e) => setLinkVideo(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Folder lớp học (bỏ trống nếu buổi này không có)"
              value={linkFolder}
              onChange={(e) => setLinkFolder(e.target.value)}
            />
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Dòng nào bỏ trống sẽ không xuất hiện trong bản nhận xét.
            </p>
          </div>

          {/* SUBMIT */}
          <button
            onClick={handleGenerate}
            disabled={!isReady || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-sm px-5 py-3.5 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang viết nhận xét...
              </>
            ) : (
              <>✍️ Tạo bản nhận xét</>
            )}
          </button>
          {!isReady && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold -mt-3">
              ⚠️ Cần nhập API Key, tên giáo viên, khóa học, buổi số, ngày học và chủ đề.
            </p>
          )}
        </div>

        {/* ===== RIGHT: OUTPUT ===== */}
        <div className="lg:col-span-7 p-6 sm:p-8 space-y-4">
          {isLoading && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20 p-6">
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-3">
                Đang soạn bản nhận xét theo mẫu {SESSION_TYPES.find((t) => t.id === sessionType)?.label}...
              </p>
              <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
              <p className="text-sm font-bold text-red-600 dark:text-red-400">❌ {error}</p>
            </div>
          )}

          {!output && !isLoading && !error && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-8">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                Bản nhận xét sẽ hiện ở đây
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
                Điền ghi chú ngắn gọn bên trái rồi bấm tạo. Kết quả có thể sửa trực tiếp trước khi copy
                gửi phụ huynh.
              </p>
            </div>
          )}

          {output && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-200">
                    ✅ Bản nhận xét hoàn chỉnh
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                    {output.length} ký tự · có thể sửa trực tiếp
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  📋 Copy nội dung
                </button>
              </div>
              <textarea
                value={output}
                onChange={(e) => setOutput(e.target.value)}
                className="w-full min-h-[600px] rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
              />
            </>
          )}
        </div>
      </div>

      <Toast message={toastMessage} onClose={() => setToastMessage("")} />
    </div>
  );
}
