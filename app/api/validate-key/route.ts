import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Current Gemini model names (August 2026)
const TEST_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];

/** Extract HTTP status code from Google SDK error message like "[400 Bad Request] ..." */
function extractHttpStatus(msg: string): number {
  const match = msg.match(/\[(\d{3})\s/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Returns true if the error is clearly an auth/key problem */
function isAuthError(msg: string, httpStatus: number): boolean {
  if (httpStatus === 401 || httpStatus === 403) return true;
  // Google returns 400 for invalid API keys
  if (
    httpStatus === 400 &&
    (msg.toLowerCase().includes('api key') ||
      msg.includes('API_KEY_INVALID') ||
      msg.includes('invalid'))
  )
    return true;
  if (msg.includes('API_KEY_INVALID')) return true;
  if (msg.includes('API key not valid')) return true;
  if (msg.includes('PERMISSION_DENIED')) return true;
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json({ valid: false, message: 'Chưa có API Key.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());
    let allBusy = true; // assume all servers busy until proven otherwise

    for (const modelName of TEST_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Reply with the single word: OK');
        const text = result.response.text();

        if (text) {
          // ✅ Real successful response — key is confirmed valid
          return NextResponse.json({
            valid: true,
            message: 'API Key hợp lệ và hoạt động tốt!',
          });
        }
      } catch (err: any) {
        const msg: string = err?.message || '';
        const httpStatus = extractHttpStatus(msg);

        console.warn(`[validate-key] model=${modelName} status=${httpStatus} err=${msg.slice(0, 150)}`);

        if (isAuthError(msg, httpStatus)) {
          // ❌ Confirmed bad key — stop immediately
          let friendlyMsg = 'API Key không hợp lệ. Vui lòng kiểm tra lại.';
          if (msg.includes('PERMISSION_DENIED')) {
            friendlyMsg = 'API Key bị từ chối quyền. Key chưa được kích hoạt Gemini API.';
          } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
            friendlyMsg = 'API Key đúng nhưng đã hết quota. Kiểm tra lại trên Google AI Studio.';
          }
          return NextResponse.json({ valid: false, message: friendlyMsg }, { status: 400 });
        }

        // 503, 429, 404 (model not found) → server-side issue, not key issue
        if (httpStatus === 503 || httpStatus === 429 || httpStatus === 404) {
          // Still possibly a server-busy situation, keep allBusy = true
          continue;
        }

        // Unknown error → mark as not purely "busy" and continue
        allBusy = false;
        continue;
      }
    }

    // No model confirmed success AND no auth error detected
    // → We cannot confirm the key is valid
    if (allBusy) {
      return NextResponse.json(
        {
          valid: false,
          message:
            'Không thể xác nhận API Key — máy chủ Google AI đang quá tải (503). Vui lòng thử lại sau vài phút.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { valid: false, message: 'Không thể xác nhận API Key. Vui lòng thử lại.' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, message: 'Lỗi kết nối máy chủ. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
