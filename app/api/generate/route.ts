import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Redis from 'ioredis';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Fallback models in case of 503 Service Unavailable / High demand spikes
const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
];

export async function POST(req: NextRequest) {
  try {
    const { prompt: scriptInfo, duration, char1Name, char1Pronoun, char1Voice, char2Name, char2Pronoun, char2Voice } = await req.json();

    if (!scriptInfo || !char1Name || !char1Pronoun || !char2Name || !char2Pronoun) {
      return NextResponse.json({ error: 'Thiếu thông tin yêu cầu.' }, { status: 400 });
    }

    let systemInstruction = `Bạn là chuyên gia viết kịch bản hội thoại. Dựa vào thông tin yêu cầu, hãy viết kịch bản chia thành các phân đoạn rõ ràng (Phần 1, Phần 2,...).

QUY TẮC VỀ PHONG CÁCH HỘI THOẠI (QUAN TRỌNG NHẤT):
- Mỗi lượt nói PHẢI ngắn gọn, tự nhiên như ngoài đời thực: 1–3 câu là đủ, KHÔNG viết quá dài.
- Tránh diễn đạt dài dòng, văn hoa, hay giải thích quá nhiều trong một lượt thoại.
- Hai nhân vật qua lại nhanh, nhịp điệu hội thoại phải linh hoạt, có chỗ ngắt, có câu hỏi ngắn, có câu đáp gọn.
- Dùng từ ngữ đời thường, khẩu ngữ phù hợp, có thể dùng "ừ", "thì", "mà", "chứ", "đó", "vậy", "nha", v.v.
- CÓ THỂ thêm các từ ngập ngừng, ậm ừ tự nhiên như "ờ...", "à...", "ừm...", "thì... thì...", "ý là..." để nhân vật nghe thật và sống động hơn. Dùng một cách tự nhiên, không lạm dụng.
- Nhân vật được phép nói chưa hết ý rồi bị ngắt, hoặc hỏi lại, hoặc đổi chủ đề — y như hội thoại thật.
- TUYỆT ĐỐI KHÔNG để một nhân vật độc thoại dài nhiều câu liền tục.
- TUYỆT ĐỐI KHÔNG để nhân vật gọi tên nhau trong lời thoại (không nói "Minh ơi...", "Linh à..." v.v.). Chỉ dùng cách xưng hô (anh, em, bạn...) khi cần, còn không thì nói thẳng vào nội dung.

QUY TẮC ĐỊNH DẠNG VÀ TRÌNH BÀY:
1. Nhân vật 1 tên ${char1Name}, giới tính ${char1Voice === 'female' ? 'NỮ' : 'NAM'}, xưng là "${char1Pronoun}" khi nói về bản thân.
2. Nhân vật 2 tên ${char2Name}, giới tính ${char2Voice === 'female' ? 'NỮ' : 'NAM'}, xưng là "${char2Pronoun}" khi nói về bản thân.
3. Khi cần gọi hoặc đề cập đến đối phương, dùng cách xưng hô phù hợp với GIỚI TÍNH và quan hệ thực tế. Gợi ý: nếu đối phương là NỮ có thể gọi là "bà" (thân mật, bạn bè), "bạn", "cô", "chị", "em" — KHÔNG gọi là "ông", "anh". Nếu đối phương là NAM có thể gọi là "ông" (thân mật), "bạn", "anh", "chú", "em" — KHÔNG gọi là "bà", "chị". Ưu tiên cách xưng hô phù hợp ngữ cảnh và tự nhiên nhất.
4. BẮT BUỘC ghi tên nhân vật ở đầu mỗi câu thoại theo chuẩn dạng: [${char1Name}]: hoặc [${char2Name}]:.
5. Tiêu đề các phân đoạn BẮT BUỘC ghi theo chuẩn Markdown Heading 2: ## Phần 1: [Tên phần], ## Phần 2: [Tên phần]...
6. TUYỆT ĐỐI KHÔNG IN ĐẬM nội dung câu thoại hay bất kỳ lời văn nào phía sau.
7. Cách 1 dòng trống giữa các câu thoại để trình bày thoáng mắt.
8. Văn phong nói chuyện tự nhiên, thuần Việt, đúng tâm lý nhân vật.`;

    if (duration) {
      systemInstruction += `\n9. Kịch bản cần viết chi tiết, mở rộng các phân đoạn hội thoại sinh động phù hợp thời lượng ước tính khoảng ${duration} phút.`;
    }

    const prompt = `Hệ thống: ${systemInstruction}\n\nThông tin kịch bản:\n${scriptInfo}\n\nHãy viết kịch bản hội thoại:`;

    let script = '';
    let lastError: any = null;

    // Try primary model and fall back automatically if Google server returns 503 / high demand error
    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        script = response.text();
        if (script) {
          console.log(`Successfully generated script using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${modelName} encountered error (trying fallback):`, err?.message || err);
        lastError = err;
      }
    }

    if (!script) {
      throw lastError || new Error('Hệ thống máy chủ Google AI đang bận. Vui lòng thử lại sau giây lát.');
    }

    // Try saving to Redis DB safely (non-blocking if DB fails)
    let shareId = '';
    try {
      if (process.env.REDIS_URL) {
        shareId = crypto.randomUUID();
        const redis = new Redis(process.env.REDIS_URL, {
          connectTimeout: 2000,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        // Save script to Redis with 1-day auto-expiration (TTL = 86400s)
        await redis.set(shareId, script, 'EX', 60 * 60 * 24 * 1);
        redis.disconnect();
      }
    } catch (redisError) {
      console.warn('Lỗi kết nối Redis (kịch bản vẫn được hiển thị bình thường):', redisError);
      shareId = '';
    }

    return NextResponse.json({ text: script, shareId });
  } catch (error: any) {
    console.error('API Generate Error:', error);
    const errorMsg = error?.message || 'Đã xảy ra lỗi trong quá trình tạo kịch bản.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
