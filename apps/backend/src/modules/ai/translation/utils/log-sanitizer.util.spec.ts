import { describe, it, expect } from 'vitest';
import { sanitizeLogMessage } from './log-sanitizer.util';

describe('sanitizeLogMessage', () => {
  it('khử sạch Authorization Bearer header và standalone Bearer token', () => {
    const raw =
      'Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token và Bearer secret_token_123';
    const sanitized = sanitizeLogMessage(raw);
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(sanitized).not.toContain('secret_token_123');
    expect(sanitized).toContain('Authorization: Bearer [REDACTED]');
    expect(sanitized).toContain('Bearer [REDACTED]');
  });

  it('khử độc lập các vendor-specific API keys (Groq, OpenRouter, NVIDIA, OpenAI, Google)', () => {
    // Trường hợp key đứng trần trong văn bản
    const groqRaw = 'Auth failed for token gsk_abcdef1234567890abcdef1234567890';
    expect(sanitizeLogMessage(groqRaw)).toBe('Auth failed for token gsk_[REDACTED]');

    // Trường hợp key sau nhãn key-value
    const groqErr = 'Error: Invalid API Key: gsk_abcdef1234567890abcdef1234567890';
    expect(sanitizeLogMessage(groqErr)).toContain('[REDACTED]');
    expect(sanitizeLogMessage(groqErr)).not.toContain('abcdef1234567890');

    const openRouterErr =
      'OpenRouter HTTP 401: Key sk-or-v1-abcdef0123456789abcdef0123456789 is invalid';
    expect(sanitizeLogMessage(openRouterErr)).toBe(
      'OpenRouter HTTP 401: Key sk-or-v1-[REDACTED] is invalid',
    );

    const nvidiaErr = 'NVIDIA auth failed: nvapi-abcdef1234567890abcdef1234567890';
    expect(sanitizeLogMessage(nvidiaErr)).toBe('NVIDIA auth failed: nvapi-[REDACTED]');

    const googleErr = 'Google AI request with key AIzaSyD1234567890abcdef1234567890abcdef';
    expect(sanitizeLogMessage(googleErr)).toBe('Google AI request with key AIza[REDACTED]');
  });

  it('khử các query parameter nhạy cảm bao gồm cả access_token và client_secret', () => {
    const url =
      'https://api.example.com/v1?key=AIza123&client_secret=top_secret_xyz&access_token=token_abc';
    const sanitized = sanitizeLogMessage(url);
    expect(sanitized).toContain('key=[REDACTED]');
    expect(sanitized).toContain('client_secret=[REDACTED]');
    expect(sanitized).toContain('access_token=[REDACTED]');
    expect(sanitized).not.toContain('top_secret_xyz');
    expect(sanitized).not.toContain('token_abc');
  });

  it('khử các trường JSON và key-value nhạy cảm kể cả khi có khoảng trắng sau tiền tố', () => {
    const json = JSON.stringify({
      apiKey: 'secret_key_value',
      token: 'Bearer nvapi-1234567890abcdef1234567890',
      password: 'my_super_password',
      'x-forgestore-secret': 'cf_worker_secret',
    });
    const sanitized = sanitizeLogMessage(json);
    expect(sanitized).not.toContain('secret_key_value');
    expect(sanitized).not.toContain('my_super_password');
    expect(sanitized).not.toContain('cf_worker_secret');
  });

  it('xử lý đối tượng Error chuẩn xác mà không bị nuốt thành {}', () => {
    const error = new Error(
      'Lỗi kết nối tới https://api.groq.com với key gsk_abcdef1234567890abcdef1234567890',
    );
    const sanitized = sanitizeLogMessage(error);
    expect(sanitized).toContain(
      'Error: Lỗi kết nối tới https://api.groq.com với key gsk_[REDACTED]',
    );
    expect(sanitized).not.toBe('{}');
    expect(sanitized).not.toContain('gsk_abcdef');
  });

  it('xử lý an toàn null, undefined và chuỗi bình thường', () => {
    expect(sanitizeLogMessage(null)).toBe('');
    expect(sanitizeLogMessage(undefined)).toBe('');
    expect(sanitizeLogMessage('Tin nhắn bình thường không chứa secret')).toBe(
      'Tin nhắn bình thường không chứa secret',
    );
  });
});
