import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AI Script Generator | Tạo kịch bản chuyên nghiệp",
  description: "Công cụ tạo kịch bản hội thoại AI tự động, chuyên nghiệp và nhanh chóng.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className={`${inter.className} min-h-full flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
