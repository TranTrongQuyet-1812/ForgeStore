import { randomBytes } from 'crypto';

/**
 * Trang HTML trung gian sau callback OAuth.
 *
 * Thay cho việc redirect 302 thẳng sang deep link `forgestore://...`:
 * - Người dùng thấy trang có thương hiệu thay vì nền trống + URL API trên thanh địa chỉ.
 * - `history.replaceState` dọn `?code=&state=` của GitHub/Google khỏi thanh địa chỉ.
 * - Có nút "Mở ForgeStore" dự phòng khi người dùng lỡ bấm Cancel ở hộp "Open ForgeStore?".
 */

/** Đường dẫn sạch hiển thị trên thanh địa chỉ sau khi trang đã mở deep link. */
export const DUONG_DAN_XONG = '/api/v1/xac-thuc/xong';

export type TrangThaiQuayLai = 'thanh-cong' | 'da-huy' | 'that-bai' | 'xong';

const NOI_DUNG: Record<TrangThaiQuayLai, { tieuDe: string; moTa: string }> = {
  'thanh-cong': {
    tieuDe: 'Đăng nhập thành công',
    moTa: 'Đang mở lại ForgeStore. Sau đó bạn có thể đóng tab này.',
  },
  'da-huy': {
    tieuDe: 'Bạn đã hủy đăng nhập',
    moTa: 'Quay lại ForgeStore để thử lại bất cứ lúc nào.',
  },
  'that-bai': {
    tieuDe: 'Đăng nhập chưa hoàn tất',
    moTa: 'Đã có lỗi xảy ra. Hãy quay lại ForgeStore và thử lại.',
  },
  xong: {
    tieuDe: 'Bạn có thể đóng tab này',
    moTa: 'Hãy quay lại ứng dụng ForgeStore để tiếp tục.',
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Chuỗi JS an toàn khi nhúng trong thẻ <script> (chặn đóng thẻ sớm bằng `</script>`). */
function jsString(s: string): string {
  return JSON.stringify(s).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F97316"/><stop offset="100%" stop-color="#EA580C"/></linearGradient></defs><rect width="48" height="48" rx="12" fill="#151E2E"/><path d="M24 10 L34 26 L27 26 L30 38 L18 24 L25 24 Z" fill="url(#g)"/></svg>`;

export interface TrangQuayLaiApp {
  html: string;
  /** Nonce dùng cho header Content-Security-Policy của script nội tuyến. */
  nonce: string;
}

/**
 * Dựng trang quay lại app.
 * @param deepLink Deep link về app (đã được backend kiểm tra hợp lệ). Bỏ trống với trang `xong`.
 */
export function dungTrangQuayLaiApp(
  trangThai: TrangThaiQuayLai,
  deepLink?: string,
): TrangQuayLaiApp {
  const nonce = randomBytes(16).toString('base64');
  const { tieuDe, moTa } = NOI_DUNG[trangThai];
  const coLink = Boolean(deepLink);

  const nut = coLink
    ? `<a class="btn" href="${escapeHtml(deepLink!)}">Mở ForgeStore</a>
    <p class="hint">Nếu trình duyệt hỏi có mở ForgeStore không, hãy chọn <b>Mở</b> (Open). Tích ô “Luôn cho phép” (Always allow) để lần sau không phải hỏi lại.</p>`
    : '';

  const script = coLink
    ? `<script nonce="${nonce}">
  try { history.replaceState(null, '', ${jsString(DUONG_DAN_XONG)}); } catch (e) {}
  window.location.href = ${jsString(deepLink!)};
</script>`
    : '';

  const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(tieuDe)} · ForgeStore</title>
<style>
  :root {
    --bg: #F7F5F0; --card: #FFFFFF; --border: rgba(28,25,23,.08);
    --text: #1C1917; --muted: #57534E; --hint: #8C857E; --accent: #F97316; --accent-hover: #EA580C;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0B0F19; --card: #182234; --border: rgba(255,255,255,.06);
      --text: #F1F5F9; --muted: #94A3B8; --hint: #64748B;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 16px; background: var(--bg); color: var(--text);
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  }
  main {
    width: 100%; max-width: 380px; text-align: center; background: var(--card);
    border: 1px solid var(--border); border-radius: 16px; padding: 32px 28px;
    box-shadow: 0 20px 50px rgba(0,0,0,.18);
  }
  .logo { margin: 0 auto 16px; width: 56px; height: 56px; }
  h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px; letter-spacing: -.01em; }
  p { margin: 0; font-size: 14px; line-height: 1.55; color: var(--muted); }
  .btn {
    display: inline-block; margin-top: 22px; padding: 11px 22px; border-radius: 12px;
    background: var(--accent); color: #fff; font-weight: 700; font-size: 14px; text-decoration: none;
  }
  .btn:hover { background: var(--accent-hover); }
  .hint { margin-top: 14px; font-size: 12px; color: var(--hint); }
</style>
</head>
<body>
  <main>
    <div class="logo">${LOGO_SVG}</div>
    <h1>${escapeHtml(tieuDe)}</h1>
    <p>${escapeHtml(moTa)}</p>
    ${nut}
  </main>
  ${script}
</body>
</html>`;

  return { html, nonce };
}
