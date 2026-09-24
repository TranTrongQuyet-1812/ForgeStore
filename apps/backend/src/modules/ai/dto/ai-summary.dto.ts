import { z } from 'zod';

/**
 * Schema cho từng tính năng nổi bật được tóm tắt từ README.
 * Bắt buộc kèm `trichDan` nguyên văn để xác thực code-check chống bịa đặt (P2-30.7 & P2-30.8).
 */
export const TinhNangChiTietSchema = z.object({
  tieuDe: z
    .string()
    .min(1, 'Tiêu đề tính năng không được để trống')
    .max(80, 'Tiêu đề tính năng tối đa 80 ký tự'),
  moTa: z
    .string()
    .min(1, 'Mô tả tính năng không được để trống')
    .max(250, 'Mô tả tính năng tối đa 250 ký tự'),
  trichDan: z
    .string()
    .min(1, 'Trích dẫn không được để trống')
    .describe('Đoạn trích dẫn nguyên văn bằng tiếng Anh hoặc ngôn ngữ gốc từ README'),
});

export type TinhNangChiTiet = z.infer<typeof TinhNangChiTietSchema>;

/**
 * Schema kết quả tóm tắt README chuẩn JSON có cấu trúc (P2-30.3).
 */
export const KetQuaTomTatSchema = z.object({
  khauHieu: z
    .string()
    .min(1, 'Khẩu hiệu không được để trống')
    .max(100, 'Khẩu hiệu tối đa 100 ký tự'),
  tinhNang: z
    .array(TinhNangChiTietSchema)
    .min(1, 'Cần ít nhất 1 tính năng')
    .max(3, 'Tối đa 3 tính năng nổi bật'),
});

export type KetQuaTomTat = z.infer<typeof KetQuaTomTatSchema>;

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
