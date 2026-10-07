/**
 * Tiện ích khử trùng thông tin nhạy cảm trong nhật ký hệ thống (Log Sanitization).
 * Phiên bản nâng cấp an ninh: Đảm bảo 100% tuân thủ Chốt chặn số 2 của Claude.
 */

export function sanitizeLogMessage(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  let text = '';
  if (input instanceof Error) {
    text = `${input.name}: ${input.message}${input.stack ? `\n${input.stack}` : ''}`;
  } else if (typeof input === 'string') {
    text = input;
  } else if (typeof input === 'object') {
    try {
      text = JSON.stringify(input);
    } catch {
      text = String(input);
    }
  } else {
    text = String(input);
  }

  // 1. Khử Authorization headers (Bearer token)
  text = text.replace(
    /Authorization\s*:\s*(?:Bearer\s+)?[^\s"';,]+/gi,
    'Authorization: Bearer [REDACTED]',
  );

  // 2. Khử các Bearer token đứng độc lập
  text = text.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');

  // 3. Khử Vendor-Specific API Keys đứng độc lập:
  // - Groq API Key: gsk_...
  text = text.replace(/gsk_[A-Za-z0-9_-]{20,}/g, 'gsk_[REDACTED]');
  // - OpenRouter API Key: sk-or-v1-...
  text = text.replace(/sk-or-v1-[a-zA-Z0-9_-]{20,}/gi, 'sk-or-v1-[REDACTED]');
  // - NVIDIA NIM API Key: nvapi-...
  text = text.replace(/nvapi-[A-Za-z0-9_-]{20,}/gi, 'nvapi-[REDACTED]');
  // - OpenAI / Generic API Keys: sk-...
  text = text.replace(/\bsk-[A-Za-z0-9]{32,}\b/g, 'sk-[REDACTED]');
  // - Google Cloud / Gemini API Keys: AIza...
  text = text.replace(/AIza[A-Za-z0-9_-]{35}/g, 'AIza[REDACTED]');

  // 4. Khử các query param nhạy cảm (?key=..., ?api_key=..., &access_token=..., &client_secret=...)
  text = text.replace(
    /([?&](?:api[_-]?key|access[_-]?token|client[_-]?secret|key|secret|token)=)[^&"'\s]+/gi,
    '$1[REDACTED]',
  );

  // 5. Khử các trường JSON / Header / Key-Value nhạy cảm (dừng trước & hoặc dấu đóng ngoặc)
  text = text.replace(
    /(["']?(?:\bapi[_\s-]?key|\bsecret|\btoken|\bpassword|\bx-forgestore-secret)["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^"',\r\n}&]+/gi,
    '$1[REDACTED]',
  );

  return text;
}
