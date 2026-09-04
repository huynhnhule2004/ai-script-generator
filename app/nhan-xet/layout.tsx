import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nhận Xét Buổi Học MindX | Soạn nhận xét gửi phụ huynh",
  description:
    "Công cụ chuyển ghi chú ngắn của giáo viên thành bản nhận xét buổi học hoàn chỉnh, đúng mẫu MindX.",
};

export default function NhanXetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
