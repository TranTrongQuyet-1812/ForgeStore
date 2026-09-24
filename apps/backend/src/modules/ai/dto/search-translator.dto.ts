import { z } from 'zod';

/**
 * Zod Schema xác thực dữ liệu trả về từ Gemini Translator (P2-42.1)
 */
export const KetQuaDichTimKiemSchema = z.object({
  tuKhoa: z
    .array(z.string().min(1).max(40))
    .min(1, 'Cần ít nhất 1 từ khóa tiếng Anh')
    .max(6, 'Tối đa 6 từ khóa'),
  topics: z.array(z.string().min(1).max(40)).max(6, 'Tối đa 6 chủ đề').default([]),
  ngonNgu: z.string().max(30).optional().nullable(),
});

export type KetQuaDichTimKiem = z.infer<typeof KetQuaDichTimKiemSchema>;
