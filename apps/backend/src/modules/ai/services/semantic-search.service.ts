import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRateLimiterService } from './llm-rate-limiter.service';

export interface KetQuaTimKiemNguNghia {
  maUngDung: string;
  tenRepoDayDu: string;
  chuSoHuu: string;
  tenKhoChua: string;
  duongDanIcon: string | null;
  soSaoGithub: number;
  danhMucChinh: string;
  nenTangHoTro: string;
  daXacMinh: boolean;
  daLuuTru: boolean;
  ngayCapNhat: Date | string;
  khauHieuTiengViet: string | null;
  diemUyTin: number | null;
  mucDoAnToan: string | null;
  doTuongDong: number;
}

interface RawSearchResult {
  maUngDung: string;
  tenRepoDayDu: string;
  chuSoHuu: string;
  tenKhoChua: string;
  duongDanIcon: string | null;
  soSaoGithub: number;
  danhMucChinh: string;
  nenTangHoTro: string;
  daXacMinh: boolean;
  daLuuTru: boolean;
  ngayCapNhat: Date;
  khauHieuTiengViet: string | null;
  diemUyTin: number | null;
  mucDoAnToan: string | null;
  khoangCach: number;
}

/**
 * Ngưỡng độ giống (P3B-09.4), đo ngày 10/10/2026 trên 21 câu hỏi mẫu với 24 app trong Store.
 * Khoảng cách cosine: kết quả đúng nằm ở 0.28 đến 0.42, câu không liên quan (thời tiết, vé máy bay)
 * có kết quả tốt nhất từ 0.43 trở lên. Điểm tốt nhất thay đổi theo cách viết câu hỏi nên ngoài
 * ngưỡng tuyệt đối còn giữ các kết quả sát điểm tốt nhất, bỏ phần đuôi.
 */
export const NGUONG_KHOANG_CACH_TOI_DA = 0.42;
export const BIEN_DO_SO_VOI_KET_QUA_TOT_NHAT = 0.05;

/** Lọc danh sách đã sắp tăng dần theo khoảng cách: ít kết quả thì trả ít, có thể trả rỗng. */
export function locTheoNguongDoGiong<T extends { khoangCach: number }>(
  ketQua: T[],
  nguongToiDa = NGUONG_KHOANG_CACH_TOI_DA,
  bienDo = BIEN_DO_SO_VOI_KET_QUA_TOT_NHAT,
): T[] {
  if (ketQua.length === 0) return [];
  const tot = Math.min(...ketQua.map((r) => r.khoangCach));
  if (tot > nguongToiDa) return [];
  const gioiHan = Math.min(nguongToiDa, tot + bienDo);
  return ketQua.filter((r) => r.khoangCach <= gioiHan);
}

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);
  private readonly client: GoogleGenAI | null = null;
  public readonly embeddingModel: string;
  public static readonly CHIEU_DAI_VECTOR = 768; // Quyết định D-10

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rateLimiter: LlmRateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.embeddingModel =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL') || 'gemini-embedding-001';

    if (apiKey && apiKey.trim() && !apiKey.startsWith('your_')) {
      try {
        this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.logger.log(
          `SemanticSearchService khởi tạo thành công với embedding model [${this.embeddingModel}] (768 chiều)`,
        );
      } catch (err) {
        this.logger.error('Lỗi khởi tạo GoogleGenAI cho Embedding:', err);
      }
    } else {
      this.logger.warn(
        'GEMINI_API_KEY chưa được cấu hình. SemanticSearchService sẽ chạy ở chế độ hạn chế.',
      );
    }
  }

  /**
   * Chuẩn bị chuỗi văn bản để sinh vector embedding theo P2-36.1:
   * "tên + slogan + tính năng + topics"
   */
  chuanBiVanBanNhung(app: {
    tenKhoChua: string;
    slogan?: string | null;
    tinhNang?: string[];
    topics?: string[];
    moTa?: string | null;
  }): string {
    const parts: string[] = [];
    parts.push(`Ứng dụng: ${app.tenKhoChua}`);
    if (app.slogan?.trim()) {
      parts.push(`Khẩu hiệu: ${app.slogan.trim()}`);
    }
    if (app.tinhNang && app.tinhNang.length > 0) {
      parts.push(`Tính năng: ${app.tinhNang.join('; ')}`);
    }
    if (app.topics && app.topics.length > 0) {
      parts.push(`Chủ đề: ${app.topics.join(', ')}`);
    }
    if (app.moTa?.trim()) {
      parts.push(`Mô tả: ${app.moTa.trim()}`);
    }
    return parts.join('\n');
  }

  /**
   * Sinh vector embedding 768 chiều qua GoogleGenAI (P2-36.1, D-10).
   * Không xoay sang NVIDIA NIM theo quy chuẩn P2-39.8.
   */
  async sinhEmbedding(vanBan: string): Promise<number[]> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY không khả dụng để sinh embedding.');
    }

    const cleanText = vanBan.trim();
    if (!cleanText) {
      throw new Error('Văn bản đầu vào sinh embedding không được để trống.');
    }

    // Kiểm tra Token Bucket cho Gemini Embedding (80 RPM) (AI1)
    const token = await this.rateLimiter.layToken('gemini_embedding', 3000);
    if (!token.chapNhan) {
      throw new Error(
        `Gemini Embedding đã chạm trần Rate Limit (${token.capacity} RPM). Vui lòng thử lại sau.`,
      );
    }

    try {
      const response = await this.client.models.embedContent({
        model: this.embeddingModel,
        contents: cleanText,
        config: {
          outputDimensionality: SemanticSearchService.CHIEU_DAI_VECTOR,
        },
      });

      const vector = response.embeddings?.[0]?.values;
      if (!vector || vector.length === 0) {
        throw new Error('Mô hình Gemini không trả về dữ liệu vector.');
      }

      if (vector.length !== SemanticSearchService.CHIEU_DAI_VECTOR) {
        this.logger.warn(
          `Kích thước vector [${vector.length}] khác chuẩn [${SemanticSearchService.CHIEU_DAI_VECTOR}]`,
        );
      }

      return vector;
    } catch (err: unknown) {
      this.logger.error(`Lỗi sinh vector embedding: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Lưu vector embedding vào cột `vector_ngu_nghia` qua SQL thô ($executeRaw) theo P2-36.2.
   * Cột Unsupported("vector(768)") không thể cập nhật trực tiếp qua Prisma Client API.
   */
  async luuVectorNguNghia(maPhanTich: string, vector: number[]): Promise<void> {
    if (!vector || vector.length === 0) {
      return;
    }

    const vectorStr = `[${vector.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE "phan_tich_ai"
      SET "vector_ngu_nghia" = ${vectorStr}::vector,
          "ngay_cap_nhat" = NOW()
      WHERE "ma_phan_tich" = ${maPhanTich}::uuid
    `;
  }

  /**
   * Tìm kiếm ứng dụng bằng ý định tự nhiên / ngữ nghĩa với pgvector (P2-36.3, AI2).
   * Lọc theo platform và chỉ trả app có file cài hợp lệ (L1, AI2).
   * Sử dụng toán tử khoảng cách cosine `<=>` được tăng tốc bởi chỉ mục HNSW `idx_phan_tich_ai_vector` (D-16).
   */
  async timKiemNguNghia(
    cauTruyVan: string,
    gioiHan = 20,
    platform?: string,
  ): Promise<KetQuaTimKiemNguNghia[]> {
    const vector = await this.sinhEmbedding(cauTruyVan);
    const vectorStr = `[${vector.join(',')}]`;

    const plat = platform ? platform.toUpperCase() : undefined;
    let platformCondition = Prisma.empty;

    if (plat === 'WINDOWS') {
      // BE-V3-02: Lọc trực tiếp theo nen_tang_ho_tro và trang_thai = 'HOAT_DONG' đã có B-tree index,
      // loại bỏ subquery EXISTS tương quan gây suy giảm hiệu năng duyệt đồ thị HNSW
      platformCondition = Prisma.sql`
        AND u."nen_tang_ho_tro" IN ('WINDOWS', 'DA_NEN_TANG')
      `;
    } else if (plat === 'ANDROID') {
      platformCondition = Prisma.sql`
        AND u."nen_tang_ho_tro" IN ('ANDROID', 'DA_NEN_TANG')
      `;
    }

    const ketQua = await this.prisma.$queryRaw<RawSearchResult[]>`
      SELECT 
        u."ma_ung_dung" AS "maUngDung",
        u."ten_repo_day_du" AS "tenRepoDayDu",
        u."chu_so_huu" AS "chuSoHuu",
        u."ten_kho_chua" AS "tenKhoChua",
        u."duong_dan_icon" AS "duongDanIcon",
        u."so_sao_github" AS "soSaoGithub",
        u."danh_muc_chinh" AS "danhMucChinh",
        u."nen_tang_ho_tro" AS "nenTangHoTro",
        u."da_xac_minh" AS "daXacMinh",
        u."da_luu_tru" AS "daLuuTru",
        u."dong_bo_lan_cuoi" AS "ngayCapNhat",
        pa."khau_hieu_tieng_viet" AS "khauHieuTiengViet",
        pa."diem_uy_tin" AS "diemUyTin",
        pa."muc_do_an_toan" AS "mucDoAnToan",
        (pa."vector_ngu_nghia" <=> ${vectorStr}::vector) AS "khoangCach"
      FROM "phan_tich_ai" pa
      JOIN "ung_dung" u ON pa."ma_ung_dung" = u."ma_ung_dung"
      WHERE pa."vector_ngu_nghia" IS NOT NULL
        AND u."trang_thai" = 'HOAT_DONG'
        ${platformCondition}
      ORDER BY pa."vector_ngu_nghia" <=> ${vectorStr}::vector ASC
      LIMIT ${gioiHan}
    `;

    return locTheoNguongDoGiong(ketQua).map((row) => ({
      maUngDung: row.maUngDung,
      tenRepoDayDu: row.tenRepoDayDu,
      chuSoHuu: row.chuSoHuu,
      tenKhoChua: row.tenKhoChua,
      duongDanIcon: row.duongDanIcon,
      soSaoGithub: row.soSaoGithub,
      danhMucChinh: row.danhMucChinh,
      nenTangHoTro: row.nenTangHoTro,
      daXacMinh: row.daXacMinh,
      daLuuTru: Boolean(row.daLuuTru),
      ngayCapNhat: row.ngayCapNhat,
      khauHieuTiengViet: row.khauHieuTiengViet,
      diemUyTin: row.diemUyTin,
      mucDoAnToan: row.mucDoAnToan,
      doTuongDong: Math.max(0, 1 - (row.khoangCach || 0)),
    }));
  }
}
