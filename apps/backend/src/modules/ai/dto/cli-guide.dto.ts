import { z } from 'zod';
import { HeDieuHanhCli, NhomCachCai, PhanCungYeuCau } from '@forgestore/types';

/**
 * Zod Schema cho từng bước cài đặt dòng lệnh do AI trả về.
 */
export const BuocCaiAiSchema = z.object({
  moTa: z.string().min(1, 'Mô tả bước không được rỗng').max(200),
  lenh: z.string().min(1, 'Lệnh không được rỗng'),
  ruiRoCao: z.boolean().optional(),
  canhBaoRuiRo: z.string().optional(),
});

export type BuocCaiAi = z.infer<typeof BuocCaiAiSchema>;

/**
 * Zod Schema cho từng cách cài đặt do AI trả về.
 */
export const CachCaiAiSchema = z.object({
  ten: z.string().min(1).max(100),
  nhom: z.nativeEnum(NhomCachCai).default(NhomCachCai.PIP),
  heDieuHanh: z.nativeEnum(HeDieuHanhCli).default(HeDieuHanhCli.DUNG_CHUNG),
  phanCung: z.nativeEnum(PhanCungYeuCau).default(PhanCungYeuCau.KHONG_RO),
  yeuCau: z.array(z.string()).optional().default([]),
  buoc: z.array(BuocCaiAiSchema).min(1, 'Cần ít nhất 1 bước cài đặt'),
});

export type CachCaiAi = z.infer<typeof CachCaiAiSchema>;

/**
 * Zod Schema kết quả đầu ra tổng thể của AI khi bóc tách hướng dẫn CLI.
 */
export const HuongDanCaiDatAiSchema = z.object({
  cachCai: z.array(CachCaiAiSchema).default([]),
});

export type HuongDanCaiDatAi = z.infer<typeof HuongDanCaiDatAiSchema>;
