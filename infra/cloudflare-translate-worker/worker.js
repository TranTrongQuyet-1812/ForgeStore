/* global URL, Response, TextEncoder, crypto, console, setTimeout, clearTimeout */
/**
 * ForgeStore - Worker dịch văn bản sang tiếng Việt (Cloudflare Workers AI).
 *
 * Mô hình mặc định: @cf/aisingapore/gemma-sea-lion-v4-27b-it (mô hình trò chuyện đa ngôn ngữ Đông Nam Á,
 * hiểu lệnh nên giữ được ký hiệu giữ chỗ; GLM-4.7-flash bị loại vì treo quá 60 s với đoạn dài).
 * Có thể đổi mô hình mà không cần sửa mã: đặt biến TRANSLATE_MODEL trong Settings của Worker.
 *
 * Quy tắc an toàn quan trọng: Worker KHÔNG BAO GIỜ trả bản gốc giả làm bản dịch.
 * Đoạn nào lỗi, rỗng, hoặc làm đổi số ký hiệu / tiêu đề / dòng bảng so với đầu vào thì trả null,
 * kèm lý do trong `reasons`, để backend giữ bản gốc, ghi nhận lỗi và chuyển sang nhà dịch khác.
 *
 * POST /translate
 *   Header: X-ForgeStore-Secret: <TRANSLATE_SECRET>
 *   Body:   { "texts": ["đoạn 1", "đoạn 2"] }   hoặc   { "text": "một đoạn" }
 *   Trả về: { provider, model, translations: [string|null], reasons: [string|null], failed: number,
 *             translation?: string|null }   (translation chỉ có khi gửi "text")
 */

const DEFAULT_MODEL = '@cf/aisingapore/gemma-sea-lion-v4-27b-it';

// Giới hạn để nằm trong gói miễn phí (50 lời gọi con mỗi yêu cầu) và chống lạm dụng.
const MAX_SEGMENTS = 20;
const MAX_CHARS_PER_SEGMENT = 5000;
const MAX_TOTAL_CHARS = 40000;
const MAX_BODY_BYTES = 200_000;
const MAX_OUTPUT_TOKENS = 6000;
const CONCURRENCY = 3;

const SYSTEM_PROMPT = `Bạn là biên dịch viên tài liệu kỹ thuật phần mềm mã nguồn mở, dịch sang tiếng Việt chính xác và tự nhiên.
Văn bản nguồn có thể là tiếng Anh, tiếng Trung hoặc lẫn nhiều ngôn ngữ: hãy dịch toàn bộ phần văn xuôi sang tiếng Việt.
QUY TẮC BẮT BUỘC:
1. Giữ NGUYÊN VẸN mọi ký hiệu giữ chỗ dạng [C1], [C2], [C3]... (hoặc ⟦C1⟧). Không xóa, sửa, dịch, thêm, gộp hay đổi thứ tự trong cùng một câu.
2. Giữ nguyên cấu trúc Markdown: cấp độ tiêu đề (#, ##, ###), mỗi tiêu đề nằm trên một dòng riêng, bảng (|---|---|), danh sách, in đậm.
3. Không dịch tên phần mềm, tên riêng, các thuật ngữ kỹ thuật thông dụng (API, CLI, SDK, plugin, hook, cache, token, commit, pull request...) và các tên ngôn ngữ hiển thị như 中文, 日本語.
4. Dịch trung thực, không tóm tắt, không rút ngắn.
5. CHỈ trả về bản dịch. Không lời chào, không giải thích, không bọc trong khối code.`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/translate') {
      return json({ error: 'not_found' }, 404);
    }

    // Chưa đặt khóa bí mật thì từ chối hết, tránh vô tình mở công khai.
    if (!env.TRANSLATE_SECRET) {
      return json({ error: 'server_not_configured' }, 503);
    }
    const given = request.headers.get('X-ForgeStore-Secret') ?? '';
    if (!(await safeEqual(given, env.TRANSLATE_SECRET))) {
      return json({ error: 'unauthorized' }, 401);
    }

    const declared = Number(request.headers.get('Content-Length') ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return json({ error: 'body_too_large' }, 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const single = typeof body?.text === 'string' && !Array.isArray(body?.texts);
    const check = validate(body, single);
    if (check.error) {
      return json({ error: check.error }, 400);
    }

    const model =
      typeof body?.model === 'string' && body.model.startsWith('@cf/')
        ? body.model
        : env.TRANSLATE_MODEL || DEFAULT_MODEL;
    const results = await mapWithLimit(check.texts, CONCURRENCY, (text) =>
      translateOne(env, model, text),
    );
    const translations = results.map((r) => r.text);
    const reasons = results.map((r) => r.reason);
    const failed = translations.filter((t) => t === null).length;

    const payload = { provider: 'cloudflare-workers-ai', model, translations, reasons, failed };
    if (single) payload.translation = translations[0];
    return json(payload);
  },
};

function validate(body, single) {
  if (!body || typeof body !== 'object') return { error: 'invalid_body' };
  const texts = single ? [body.text] : body.texts;
  if (!Array.isArray(texts)) return { error: 'texts_or_text_required' };
  if (texts.length === 0 || texts.length > MAX_SEGMENTS) {
    return { error: `texts_must_have_1_to_${MAX_SEGMENTS}_items` };
  }
  let total = 0;
  for (const t of texts) {
    if (typeof t !== 'string') return { error: 'texts_must_be_strings' };
    if (t.length > MAX_CHARS_PER_SEGMENT)
      return { error: `segment_longer_than_${MAX_CHARS_PER_SEGMENT}_chars` };
    total += t.length;
  }
  if (total > MAX_TOTAL_CHARS) return { error: `total_longer_than_${MAX_TOTAL_CHARS}_chars` };

  const target = String(body.target ?? 'vietnamese').toLowerCase();
  if (target !== 'vietnamese' && target !== 'vi')
    return { error: 'only_vietnamese_target_supported' };
  return { texts };
}

async function translateOne(env, model, text) {
  if (text.trim() === '') return { text, reason: null };
  let out;
  try {
    const input = {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Dịch đoạn Markdown sau sang tiếng Việt:\n\n${text}` },
      ],
      temperature: 0.1,
      max_tokens: MAX_OUTPUT_TOKENS,
    };
    // Tùy chọn cho mô hình có chế độ suy luận lai: đặt TRANSLATE_DISABLE_THINKING=1 nếu thấy kết quả rỗng.
    if (env.TRANSLATE_DISABLE_THINKING === '1') {
      input.chat_template_kwargs = { enable_thinking: false };
    }
    out = await withTimeout(env.AI.run(model, input), timeoutMs(env));
  } catch (err) {
    console.warn('translate segment failed:', String(err?.message ?? err));
    return { text: null, reason: err?.code === 'TIMEOUT' ? 'timeout' : 'ai_error' };
  }

  const translated = cleanOutput(extractText(out), text);
  if (translated === '') return { text: null, reason: 'empty_output' };
  const problem = findStructureProblem(text, translated);
  if (problem) return { text: null, reason: problem };
  return { text: translated, reason: null };
}

const DEFAULT_TIMEOUT_MS = 50_000;

function timeoutMs(env) {
  const n = Number(env.TRANSLATE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** Mô hình treo (hàng đợi nghẽn) thì bỏ qua đoạn đó, không để một yêu cầu chậm kẹt cả hàng đợi. */
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Mô hình trả kết quả theo nhiều dạng khác nhau tùy loại: lấy chữ ra từ dạng nào cũng được. */
export function extractText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out;
  const candidate =
    out.response ??
    out.result?.response ??
    out.choices?.[0]?.message?.content ??
    out.content ??
    out.text ??
    '';
  return typeof candidate === 'string' ? candidate : '';
}

/** Bỏ phần "suy nghĩ" rò rỉ và khối code bọc ngoài mà đầu vào không có. */
export function cleanOutput(text, input) {
  let t = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
  const wrapped = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (wrapped && !/^```/m.test(input)) t = wrapped[1].trim();
  return t;
}

const PLACEHOLDER = /\[C\d+\]|⟦C\d+⟧/g;
const HEADING = /^#{1,6}\s/gm;
const TABLE_ROW = /^\s*\|.*\|\s*$/gm;

/** Trả về lý do nếu bản dịch làm hỏng cấu trúc, ngược lại null. */
export function findStructureProblem(input, output) {
  const a = (input.match(PLACEHOLDER) ?? []).sort();
  const b = (output.match(PLACEHOLDER) ?? []).sort();
  if (a.length !== b.length || a.some((x, i) => x !== b[i])) return 'placeholders_changed';
  if ((input.match(HEADING) ?? []).length !== (output.match(HEADING) ?? []).length)
    return 'headings_changed';
  if ((input.match(TABLE_ROW) ?? []).length !== (output.match(TABLE_ROW) ?? []).length)
    return 'table_changed';
  return null;
}

async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** So sánh hai chuỗi qua mã băm SHA-256: chạy được cả trên Cloudflare lẫn Node, không rò độ dài khóa. */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
