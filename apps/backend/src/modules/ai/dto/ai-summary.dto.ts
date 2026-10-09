import { z } from 'zod';

/**
 * Schema kết quả tóm tắt Changelog bản phát hành mới (P2-34).
 */
export const KetQuaChangelogSchema = z.object({
  diemMoi: z
    .array(z.string().min(1).max(250))
    .min(1, 'Cần ít nhất 1 điểm mới')
    .max(4, 'Tối đa 4 điểm mới trong changelog'),
});

export type KetQuaChangelog = z.infer<typeof KetQuaChangelogSchema>;
