import { Logger } from '@nestjs/common';
import type {
  KetQuaDichBatchJson,
  NhaCungCapDich,
} from '../interfaces/translation-provider.interface';
import { trichXuatJsonTuPhanHoi } from '../prompts/translation.prompt';
import { sanitizeLogMessage } from '../tien-ich/log-sanitizer.util';

const logger = new Logger('BatchTranslationUtil');

/**
 * Phân tích và chuẩn hóa kết quả phản hồi thô từ các provider khi dịch gom lô (P3B-04 & Fix Lỗi 4).
 * Loại bỏ mã lặp giữa Gemini, NVIDIA NIM, Groq.
 */
export function phanTichKetQuaBatchJson(
  rawText: string,
  provider: NhaCungCapDich,
  model: string,
  durationMs: number,
  finishReason?: string,
): KetQuaDichBatchJson {
  // 1. Kiểm tra bị cắt cụt do giới hạn token
  if (finishReason === 'MAX_TOKENS' || finishReason === 'length') {
    logger.warn(
      `[${provider}] Dịch gom lô bị cắt cụt do chạm giới hạn token (finishReason = ${finishReason})`,
    );
    return {
      data: null,
      lyDoLoi: 'ai_error',
      provider,
      model,
      thoiGianMs: durationMs,
    };
  }

  // 2. Bóc tách JSON an toàn từ nội dung
  const parsedJson = trichXuatJsonTuPhanHoi(rawText);

  if (!parsedJson || Object.keys(parsedJson).length === 0) {
    logger.warn(`[${provider}] Dịch gom lô trả về rỗng hoặc không bóc tách được JSON`);
    return {
      data: null,
      lyDoLoi: 'empty_output',
      provider,
      model,
      thoiGianMs: durationMs,
    };
  }

  return {
    data: parsedJson,
    lyDoLoi: null,
    provider,
    model,
    thoiGianMs: durationMs,
  };
}

/**
 * Phân loại và chuẩn hóa lỗi cho các provider dịch gom lô JSON (P3B-04 & Fix Lỗi 4).
 */
export function phanLoaiLoiBatchJson(
  err: unknown,
  provider: NhaCungCapDich,
  model: string,
  durationMs: number,
  timeoutMs: number,
): KetQuaDichBatchJson {
  const error = err as { code?: string; message?: string; status?: number };
  const errMsg = error?.message || String(err);

  if (error?.code === 'TIMEOUT' || errMsg.includes('TIMEOUT') || errMsg.includes('aborted')) {
    logger.warn(`[${provider}] Dịch gom lô thất bại: Hết thời gian chờ (${timeoutMs}ms)`);
    return {
      data: null,
      lyDoLoi: 'timeout',
      provider,
      model,
      thoiGianMs: durationMs,
    };
  }

  if (
    error?.status === 429 ||
    /\b429\b/.test(errMsg) ||
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.toLowerCase().includes('rate limit') ||
    errMsg.toLowerCase().includes('too many requests')
  ) {
    logger.warn(`[${provider}] Dịch gom lô chạm giới hạn tỷ lệ (429)`);
    return {
      data: null,
      lyDoLoi: 'rate_limited',
      provider,
      model,
      thoiGianMs: durationMs,
    };
  }

  logger.warn(sanitizeLogMessage(`[${provider}] Dịch gom lô gặp lỗi: ${errMsg}`));
  return {
    data: null,
    lyDoLoi: 'ai_error',
    provider,
    model,
    thoiGianMs: durationMs,
  };
}
