import Redis from "ioredis";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareDetailClient from "./ShareDetailClient";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  if (!id) {
    notFound();
  }

  let script: string | null = null;

  try {
    const redis = new Redis(process.env.REDIS_URL || "");
    script = await redis.get(id);
    redis.disconnect();
  } catch (error) {
    console.error("Error fetching script from Redis:", error);
  }

  if (!script) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-zinc-900 border border-zinc-800 shadow-2xl rounded-3xl p-10 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-3xl mx-auto">
            ⚠️
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Không tìm thấy kịch bản</h2>
            <p className="text-xs text-zinc-400">
              Link kịch bản này có thể đã hết hạn, bị xóa hoặc không hợp lệ.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-xs font-bold text-white transition-all w-full shadow-lg shadow-blue-600/30"
          >
            Tạo Kịch Bản Mới Tại Studio
          </Link>
        </div>
      </main>
    );
  }

  return <ShareDetailClient script={script} id={id} />;
}
