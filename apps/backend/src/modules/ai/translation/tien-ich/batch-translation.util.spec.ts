import { describe, it, expect } from 'vitest';
import { phanTichKetQuaBatchJson, phanLoaiLoiBatchJson } from './batch-translation.util';

describe('batch-translation.util', () => {
  describe('phanTichKetQuaBatchJson', () => {
    it('xử lý khi chạm giới hạn token (MAX_TOKENS / length) mà không làm rò rỉ token hoặc nội dung', () => {
      const resMaxTokens = phanTichKetQuaBatchJson(
        'bản dịch dở dang bị cắt...',
        'gemini',
        'gemini-3.1-flash-lite',
        150,
        'MAX_TOKENS',
      );
      expect(resMaxTokens.data).toBeNull();
      expect(resMaxTokens.lyDoLoi).toBe('ai_error');
      expect(resMaxTokens.provider).toBe('gemini');

      const resLength = phanTichKetQuaBatchJson(
        'cắt cụt...',
        'groq',
        'qwen/qwen3.8-27b',
        200,
        'length',
      );
      expect(resLength.data).toBeNull();
      expect(resLength.lyDoLoi).toBe('ai_error');
    });

    it('xử lý an toàn khi JSON rỗng hoặc malformed (không ném lỗi ngoại lệ)', () => {
      const resMalformed = phanTichKetQuaBatchJson(
        'Đây không phải JSON: { invalid json',
        'nvidia',
        'google/diffusiongemma-26b-a4b-it',
        180,
      );
      expect(resMalformed.data).toBeNull();
      expect(resMalformed.lyDoLoi).toBe('empty_output');
    });

    it('bóc tách thành công JSON hợp lệ bọc trong markdown code fence', () => {
      const rawText = '```json\n{"item1": "Bản dịch 1", "item2": "Bản dịch 2"}\n```';
      const res = phanTichKetQuaBatchJson(rawText, 'gemini', 'gemini-3.1-flash-lite', 250);
      expect(res.data).toEqual({
        item1: 'Bản dịch 1',
        item2: 'Bản dịch 2',
      });
      expect(res.lyDoLoi).toBeNull();
    });
  });

  describe('phanLoaiLoiBatchJson', () => {
    it('phân loại chính xác lỗi TIMEOUT hoặc aborted', () => {
      const errTimeout = { code: 'TIMEOUT', message: 'Hết thời gian chờ' };
      const res = phanLoaiLoiBatchJson(errTimeout, 'groq', 'model-test', 45000, 45000);
      expect(res.data).toBeNull();
      expect(res.lyDoLoi).toBe('timeout');

      const errAbort = new Error('The operation was aborted');
      const resAbort = phanLoaiLoiBatchJson(errAbort, 'groq', 'model-test', 30000, 45000);
      expect(resAbort.lyDoLoi).toBe('timeout');
    });

    it('phân loại chính xác lỗi rate limit 429 hoặc RESOURCE_EXHAUSTED', () => {
      const err429 = { status: 429, message: 'Too Many Requests' };
      const res = phanLoaiLoiBatchJson(err429, 'gemini', 'model-test', 500, 45000);
      expect(res.data).toBeNull();
      expect(res.lyDoLoi).toBe('rate_limited');

      const errExhausted = new Error('429 RESOURCE_EXHAUSTED quota exceeded');
      const resExhausted = phanLoaiLoiBatchJson(errExhausted, 'gemini', 'model-test', 600, 45000);
      expect(resExhausted.lyDoLoi).toBe('rate_limited');
    });

    it('bọc log qua sanitizeLogMessage khi gặp lỗi chung có chứa khóa API nhạy cảm', () => {
      const fakeKey = `gsk_${'1234567890abcdef1234567890abcdef'}`;
      const errWithKey = new Error(`Connection failed with key ${fakeKey}`);
      const res = phanLoaiLoiBatchJson(errWithKey, 'groq', 'model-test', 120, 45000);
      expect(res.data).toBeNull();
      expect(res.lyDoLoi).toBe('ai_error');
    });
  });
});
