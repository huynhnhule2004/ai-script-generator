import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Current Gemini model names (August 2026) — ordered by preference
const FALLBACK_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
];

// Generating a full feedback letter can take longer than the 10s serverless default
export const maxDuration = 60;

type SessionType = 'thuong' | 'checkpoint' | 'sanpham';

/** Rules that apply to every template — tone, formatting, anti-hallucination */
const COMMON_RULES = `Bạn là giáo viên MindX đang soạn tin nhắn tổng kết buổi học gửi cho phụ huynh.
Nhiệm vụ: từ các ghi chú ngắn gọn của giáo viên, viết lại thành bản nhận xét hoàn chỉnh, đúng văn phong MindX.

QUY TẮC VĂN PHONG (BẮT BUỘC):
- Giáo viên xưng "em", gọi phụ huynh là "quý phụ huynh", gọi học sinh là "các con" hoặc "các bạn".
- Giọng văn kính trọng, ấm áp, chuyên nghiệp. Các câu chốt kết thúc bằng "ạ".
- TUYỆT ĐỐI KHÔNG chê học sinh một cách trực tiếp hay tiêu cực. Mọi hạn chế phải diễn đạt theo hướng
  xây dựng: "cần cải thiện thêm về...", "tăng cường về...", "chú ý hơn khi...".
- Khi nhắc hạn chế của cả lớp, nói chung chung ("một số bạn"), KHÔNG nêu đích danh học sinh nào.
- Viết tiếng Việt tự nhiên, thuần Việt, không dùng từ Hán Việt cầu kỳ, không sáo rỗng.

QUY TẮC ĐỊNH DẠNG (BẮT BUỘC):
- Mỗi mục lớn bắt đầu bằng ký tự 📌 rồi đến tên mục và dấu hai chấm.
- TUYỆT ĐỐI KHÔNG dùng cú pháp Markdown: không **in đậm**, không ## tiêu đề, không dùng dấu * đầu dòng.
  Đây là tin nhắn gửi phụ huynh qua Zalo/Email nên phải là văn bản thuần.
- Các mục liệt kê thì mỗi ý một dòng, KHÔNG đánh dấu đầu dòng, trừ mục nhận xét cá nhân dùng số thứ tự.
- Cách một dòng trống giữa các mục lớn để dễ đọc.

QUY TẮC VỀ DỮ LIỆU (BẮT BUỘC):
- CHỈ dùng thông tin giáo viên cung cấp. TUYỆT ĐỐI KHÔNG bịa thêm tên học sinh, số buổi, ngày tháng,
  điểm số, tiến độ phần trăm hay đường link không có trong dữ liệu đầu vào.
- Giữ NGUYÊN VĂN các dòng đã cho sẵn: lời chào, câu dẫn, khối link, câu Compass, đoạn kết.
- Được phép mở rộng ghi chú vắn tắt của giáo viên thành câu văn đầy đủ, đúng ngữ cảnh môn học.

QUY TẮC VIẾT NHẬN XÉT CÁ NHÂN (QUAN TRỌNG NHẤT):
Mỗi học sinh là một mục đánh số. Dòng đầu là HỌ TÊN ĐẦY ĐỦ, xuống dòng rồi viết nhận xét.
Trong phần nhận xét, gọi học sinh bằng TÊN GỌI NGẮN (một hoặc hai tiếng cuối của họ tên).
Nhận xét mỗi em là một đoạn liền mạch 3–4 câu, đủ 3 phần theo đúng thứ tự:
  1) ĐIỂM MẠNH — khả năng, ưu điểm, tiến bộ rõ rệt của con (chủ động, nhanh nhẹn, tích cực,
     tiếp thu nhanh, áp dụng tốt, nghiêm túc, tiến bộ hơn so với các buổi trước...).
     LUÔN mở đầu bằng điểm mạnh, kể cả với học sinh còn nhiều hạn chế.
  2) ĐIỂM CẦN CẢI THIỆN — nêu nhẹ nhàng bằng các mẫu "Con cần cải thiện thêm về...",
     "Con nên tăng cường về...", "Con chú ý hơn khi...". Có thể là kỹ năng chuyên môn hoặc
     kỹ năng mềm (tư duy logic, sự sáng tạo, khả năng trình bày, tốc độ làm bài, sự tập trung).
     Nếu ghi chú của giáo viên nêu lý do khách quan (đổi đề tài, nghỉ buổi trước, máy lỗi...)
     thì PHẢI nhắc lý do đó để phụ huynh hiểu đúng, không quy trách nhiệm cho con.
  3) LỜI KHUYÊN — giải pháp cụ thể, làm được ngay ở nhà ("Con nên làm thêm bài tập bổ sung về...",
     "Con tìm hiểu thêm về...", "Con rèn luyện thêm...").
     Câu cuối kết bằng "nhé." hoặc "nha." — LUÂN PHIÊN giữa các em để không lặp giọng.
Nếu giáo viên không cung cấp thông tin học sinh nào thì BỎ HẲN mục nhận xét cá nhân chi tiết.`;

/** Structure that differs per session type */
const TEMPLATE_RULES: Record<SessionType, string> = {
  thuong: `LOẠI BUỔI HỌC: Buổi học thường (dạy kiến thức mới + thực hành).

Bố cục bắt buộc, theo đúng thứ tự:
📌 Chủ đề buổi học:  — một dòng ngắn.
📌 Nội dung buổi học: — 4 đến 5 dòng. Sắp theo mạch: các dòng "Tìm hiểu về..." (lý thuyết, khái niệm)
   trước, rồi tới các dòng "Thực hành..." đi từ bài tập nhỏ đến sản phẩm chính của buổi.
📌 Bài tập về nhà: — 2 đến 3 dòng. Dòng đầu thường là "Hoàn thiện dự án ...", các dòng sau là
   yêu cầu mở rộng cụ thể, viết bằng động từ hành động.
📌 Nhận xét tình hình học tập: — ĐÚNG 3 đoạn văn, cách nhau một dòng trống:
   Đoạn 1: "Trong buổi học thứ {N}, các con đã được tìm hiểu về ..." + đánh giá chung tích cực
           (tham gia nghiêm túc, theo kịp tiến độ lớp, hoàn thành nội dung thực hành).
   Đoạn 2: "Thông qua dự án ...", nêu cụ thể các con đã biết làm được gì, kèm điểm sáng của lớp
           ("Nhiều bạn chủ động thử nghiệm thêm các ý tưởng mới...").
   Đoạn 3: mở đầu bằng "Tuy nhiên, vẫn còn một số bạn gặp khó khăn trong việc ..." rồi tới mong muốn
           của giáo viên. Nếu giáo viên không nêu khó khăn nào thì thay đoạn này bằng một đoạn
           định hướng nhẹ nhàng cho buổi sau, KHÔNG được bịa ra khó khăn.
📌 Lời khuyên: — một đoạn văn liền mạch gồm ba ý: khuyến khích hoàn thành bài tập về nhà và luyện lại
   kiến thức trọng tâm; luyện thêm ĐÚNG khó khăn đã nêu ở đoạn 3 (bắt buộc phải khớp, không nói chung chung);
   và mời quý phụ huynh cùng các con liên hệ giáo viên hoặc trợ giảng khi gặp lỗi.
📌 Nhận xét cá nhân chi tiết: — danh sách đánh số theo quy tắc nhận xét cá nhân ở trên.
📌 Nhận xét cá nhân: Quý phụ huynh xem chi tiết trên Học bạ trực tuyến Compass.`,

  checkpoint: `LOẠI BUỔI HỌC: Buổi kiểm tra định kỳ (Checkpoint).

Bố cục bắt buộc, theo đúng thứ tự:
📌 Chủ đề buổi học: — dạng "Kiểm tra kiến thức {chủ đề} (Checkpoint {số})".
📌 Nội dung buổi học: — 2 đến 3 dòng, mỗi dòng bắt đầu bằng "Kiểm tra ..." nêu rõ mảng kiến thức
   được kiểm tra. Nếu buổi học có thêm hoạt động khác (tìm hiểu tiêu chí, lên ý tưởng dự án) thì
   thêm dòng "Tìm hiểu..." hoặc "Thực hành..." sau các dòng kiểm tra.
📌 Dặn dò về nhà: — 2 đến 3 dòng: ôn tập lại kiến thức vừa kiểm tra; xem lại bài làm để rút kinh nghiệm
   với những câu chưa hoàn thành hoặc còn sai; và các dặn dò khác giáo viên đã ghi chú.
📌 Nhận xét tình hình học tập: — NGẮN GỌN, 2 đến 3 dòng, mỗi ý một dòng, không viết thành đoạn văn dài.
   Tinh thần làm bài nghiêm túc, mức độ hoàn thành, khả năng vận dụng kiến thức đã học.
   TUYỆT ĐỐI KHÔNG có đoạn "Tuy nhiên..." — buổi kiểm tra chỉ ghi nhận, không phê bình cả lớp.
📌 Lời khuyên: — 2 đến 3 dòng ngắn dạng liệt kê, không viết thành đoạn văn.
📌 Nhận xét cá nhân chi tiết: — danh sách đánh số theo quy tắc nhận xét cá nhân ở trên.
   Điểm mạnh và điểm cần cải thiện bám vào kết quả bài kiểm tra của từng em.
📌 Nhận xét cá nhân: Quý phụ huynh xem chi tiết trên Học bạ trực tuyến Compass.`,

  sanpham: `LOẠI BUỔI HỌC: Buổi làm sản phẩm cuối khóa.

Bố cục bắt buộc, theo đúng thứ tự:
📌 Chủ đề buổi học: — một dòng ngắn, ví dụ "Dự án của em (Phần 2)".
📌 Nội dung buổi học: — CHỈ 1 đến 2 dòng. Buổi này không có kiến thức mới nên không liệt kê dài.
📌 Bài tập về nhà: — 1 đến 2 dòng, luôn hướng tới mốc của buổi kế tiếp.
📌 Nhận xét tình hình học tập: — CHỈ 1 đoạn ngắn 2 đến 3 câu, theo mạch:
   "Trong buổi học thứ {N}, các con {việc đã làm}. Nhìn chung, đa số các bạn đều làm bài với tinh thần
   rất tập trung và nghiêm túc. {Nỗ lực cụ thể của lớp}."
📌 Lời khuyên: — một đoạn ngắn, mở đầu bằng "Giáo viên dặn dò các con về nhà cố gắng ..." và LUÔN kèm
   lý do gắn với hoạt động của buổi kế tiếp ("... giúp các con có sự chuẩn bị tốt nhất cho buổi ...").
📌 Nhận xét cá nhân chi tiết: — danh sách đánh số theo quy tắc nhận xét cá nhân ở trên.
   Với buổi này, phần điểm cần cải thiện PHẢI nêu rõ tiến độ dự án theo phần trăm mà giáo viên cung cấp,
   và phần lời khuyên PHẢI gắn với mốc của buổi kế tiếp.
📌 Nhận xét cá nhân: Quý phụ huynh xem chi tiết trên Học bạ trực tuyến Compass.

LƯU Ý RIÊNG: mọi mục của buổi này (bài tập, lời khuyên, nhận xét cá nhân) đều phải hướng về
hoạt động của buổi kế tiếp mà giáo viên đã ghi chú.`,
};

const TYPE_LABEL: Record<SessionType, string> = {
  thuong: 'Buổi học thường',
  checkpoint: 'Buổi kiểm tra Checkpoint',
  sanpham: 'Buổi làm sản phẩm cuối khóa',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      apiKey,
      sessionType = 'thuong',
      teacherName,
      teacherRole = 'giáo viên',
      courseName,
      className,
      sessionNumber,
      sessionDate,
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
    } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bạn chưa nhập Gemini API Key. Vui lòng nhập API Key để sử dụng dịch vụ.' },
        { status: 401 }
      );
    }

    if (!teacherName || !courseName || !sessionNumber || !sessionDate || !topic) {
      return NextResponse.json(
        { error: 'Thiếu thông tin bắt buộc: tên giáo viên, khóa học, buổi số, ngày học và chủ đề.' },
        { status: 400 }
      );
    }

    const type: SessionType = ['thuong', 'checkpoint', 'sanpham'].includes(sessionType)
      ? sessionType
      : 'thuong';

    // Pad session number to 2 digits the way the real messages do (buổi số 06, 09, 11)
    const paddedNumber = String(sessionNumber).trim().padStart(2, '0');
    const classSuffix = className && String(className).trim() ? ` (Lớp ${String(className).trim()})` : '';

    const greeting = `Dạ em xin chào quý phụ huynh, em là ${String(teacherName).trim()} — ${teacherRole} đồng hành cùng các con trong khóa học ${String(courseName).trim()}${classSuffix} ạ.`;
    const intro = `Em xin phép gửi thông tin buổi học số ${paddedNumber} (${String(sessionDate).trim()}) của lớp như sau:`;

    const linkLines = [
      linkDenise && `📌 Link Denise: [${String(linkDenise).trim()}]`,
      linkDocs && `📌 Tài liệu môn học: [${String(linkDocs).trim()}]`,
      linkVideo && `📌 Video bài học: [${String(linkVideo).trim()}]`,
      linkFolder && `📌 Folder lớp học: [${String(linkFolder).trim()}]`,
    ]
      .filter(Boolean)
      .join('\n');

    const closing =
      'Em xin cảm ơn sự đồng hành của quý phụ huynh trong suốt quá trình học tập của các con. Kính chúc quý phụ huynh thật nhiều sức khỏe và có một tuần thật vui vẻ ạ.';

    const systemInstruction = `${COMMON_RULES}

${TEMPLATE_RULES[type]}

CÁC KHỐI VĂN BẢN CỐ ĐỊNH — CHÉP NGUYÊN VĂN, KHÔNG SỬA MỘT CHỮ:

[Mở đầu — hai dòng đầu tiên của bản nhận xét, cách nhau một dòng trống]
${greeting}

${intro}

[Khối link — đặt ngay sau mục nhận xét cá nhân, trước đoạn kết]
${linkLines || '(giáo viên không cung cấp link nào — bỏ qua khối này)'}

[Đoạn kết — dòng cuối cùng của bản nhận xét]
${closing}

Chỉ xuất ra nội dung bản nhận xét hoàn chỉnh. KHÔNG thêm lời giải thích, tiêu đề phụ hay ghi chú nào của riêng bạn.`;

    const userContent = `GHI CHÚ CỦA GIÁO VIÊN CHO BUỔI HỌC NÀY:

Loại buổi học: ${TYPE_LABEL[type]}
Khóa học: ${String(courseName).trim()}${classSuffix}
Buổi số: ${paddedNumber} — Ngày: ${String(sessionDate).trim()}
Chủ đề: ${String(topic).trim()}

Nội dung đã dạy (ghi chú vắn tắt, hãy viết lại thành câu hoàn chỉnh):
${content || '(không có — hãy suy ra từ chủ đề buổi học, bám sát chương trình, không bịa chi tiết lạ)'}

Nhận xét chung về lớp (ghi chú vắn tắt):
${generalNote || '(không có — viết đánh giá chung tích cực, trung tính, dựa trên nội dung buổi học)'}

Nhận xét cá nhân từng học sinh (mỗi dòng một em, dạng "Họ tên - ghi chú"):
${studentNotes || '(không có — bỏ hẳn mục nhận xét cá nhân chi tiết)'}

Dặn dò / bài tập về nhà (ghi chú vắn tắt):
${homework || '(không có — hãy đề xuất dặn dò hợp lý bám sát nội dung buổi học)'}

Hoạt động của buổi học kế tiếp:
${nextSession || '(không có — không nhắc tới buổi sau một cách cụ thể)'}`;

    const genAI = new GoogleGenerativeAI(apiKey.trim());

    let result = '';
    let lastError: unknown = null;

    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
        const response = await model.generateContent(userContent);
        const text = response.response.text();
        if (text && text.trim()) {
          result = text.trim();
          console.log(`Successfully generated feedback using model: ${modelName}`);
          break;
        }
      } catch (err) {
        console.warn(`Model ${modelName} encountered error (trying fallback):`, err);
        lastError = err;
      }
    }

    if (!result) {
      throw lastError || new Error('Hệ thống máy chủ Google AI đang bận. Vui lòng thử lại sau giây lát.');
    }

    return NextResponse.json({ text: result });
  } catch (error) {
    console.error('API Nhan Xet Error:', error);
    const errorMsg =
      error instanceof Error ? error.message : 'Đã xảy ra lỗi trong quá trình tạo nhận xét.';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
