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
  moTaVi?: string | null;
  moTaGocTiengAnh?: string | null;
  maBamMoTa?: string | null;
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
  moTaVi: string | null;
  moTaGocTiengAnh: string | null;
  maBamMoTa: string | null;
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

/**
 * D-33 / P3B-28.3: mỗi mô hình Embedding ghi vào một cột vector riêng. Vector của hai mô hình
 * không so sánh được với nhau, nên câu tìm kiếm sinh bằng mô hình nào thì chỉ tìm trong cột đó.
 * Thứ tự là thứ tự ưu tiên khi tìm kiếm: hết hũ ngày của mô hình trước thì dùng mô hình sau.
 */
export const MO_HINH_EMBEDDING = [
  {
    model: 'gemini-embedding-001',
    cot: 'vector_ngu_nghia',
    khoaRpm: 'gemini_embedding',
    nguong: 0.42,
  },
  // shortcut: ngưỡng Embedding 2 tạm bằng Embedding 1; đo lại khi cột 2 đã sinh đủ vector (P3B-20.7).
  {
    model: 'gemini-embedding-2',
    cot: 'vector_ngu_nghia_v2',
    khoaRpm: 'gemini_embedding_2',
    nguong: 0.42,
  },
] as const;
export type MoHinhEmbedding = (typeof MO_HINH_EMBEDDING)[number];

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
  public static readonly CHIEU_DAI_VECTOR = 768; // Quyết định D-10

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly rateLimiter: LlmRateLimiterService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey && apiKey.trim() && !apiKey.startsWith('your_')) {
      try {
        this.client = new GoogleGenAI({ apiKey: apiKey.trim() });
        this.logger.log(
          `SemanticSearchService khởi tạo với ${MO_HINH_EMBEDDING.map((m) => m.model).join(', ')} (768 chiều)`,
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
   * Sinh vector embedding 768 chiều qua GoogleGenAI (P2-36.1, D-10), có tính vào hũ ngày của mô hình.
   * Không xoay sang NVIDIA NIM theo quy chuẩn P2-39.8.
   */
  async sinhEmbedding(
    vanBan: string,
    moHinh: MoHinhEmbedding = MO_HINH_EMBEDDING[0],
  ): Promise<number[]> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY không khả dụng để sinh embedding.');
    }
    if (!vanBan.trim()) {
      throw new Error('Văn bản đầu vào sinh embedding không được để trống.');
    }
    if (!(await this.rateLimiter.giuChoEmbedding(moHinh.model))) {
      throw new Error(`${moHinh.model} đã hết lượt trong ngày.`);
    }
    return this.goiEmbedding(vanBan, moHinh);
  }

  /** Gọi API Embedding (đã giữ chỗ hũ ngày), chặn thêm theo số yêu cầu mỗi phút (AI1). */
  private async goiEmbedding(vanBan: string, moHinh: MoHinhEmbedding): Promise<number[]> {
    if (!this.client) {
      throw new Error('GEMINI_API_KEY không khả dụng để sinh embedding.');
    }
    const cleanText = vanBan.trim();
    const token = await this.rateLimiter.layToken(moHinh.khoaRpm, 3000);
    if (!token.chapNhan) {
      throw new Error(
        `Gemini Embedding đã chạm trần Rate Limit (${token.capacity} RPM). Vui lòng thử lại sau.`,
      );
    }

    try {
      // Mỗi lần gửi đúng một chuỗi: Embedding 2 gộp nhiều chuỗi thành một vector (đo 04/11/2026).
      const response = await this.client.models.embedContent({
        model: moHinh.model,
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
   * Lưu vector vào cột của đúng mô hình đã sinh ra nó, qua SQL thô ($executeRaw) theo P2-36.2.
   * Cột Unsupported("vector(768)") không thể cập nhật trực tiếp qua Prisma Client API.
   */
  async luuVectorNguNghia(
    maPhanTich: string,
    vector: number[],
    moHinh: MoHinhEmbedding = MO_HINH_EMBEDDING[0],
  ): Promise<void> {
    if (!vector || vector.length === 0) {
      return;
    }

    const vectorStr = `[${vector.join(',')}]`;
    // Tên cột lấy từ hằng MO_HINH_EMBEDDING, không bao giờ từ dữ liệu người dùng.
    await this.prisma.$executeRaw`
      UPDATE "phan_tich_ai"
      SET ${Prisma.raw(`"${moHinh.cot}"`)} = ${vectorStr}::vector,
          "ngay_cap_nhat" = NOW()
      WHERE "ma_phan_tich" = ${maPhanTich}::uuid
    `;
  }

  /**
   * P3B-28.3: sinh vector cho các app đã phân tích còn thiếu cột của mô hình này.
   * `ghi = false` chỉ đếm, không gọi AI. Dừng ngay khi hết hũ ngày để hôm sau chạy tiếp.
   */
  async boSungVectorConThieu(
    moHinh: MoHinhEmbedding,
    toiDa: number,
    ghi: boolean,
  ): Promise<{ conThieu: number; daGhi: number; loi: number }> {
    const cot = Prisma.raw(`pa."${moHinh.cot}"`);
    const dong = await this.prisma.$queryRaw<
      Array<{
        maPhanTich: string;
        tenKhoChua: string;
        khauHieu: string | null;
        chuDe: string[];
        moTa: string | null;
      }>
    >`
      SELECT pa."ma_phan_tich" AS "maPhanTich", u."ten_kho_chua" AS "tenKhoChua",
             pa."khau_hieu_tieng_viet" AS "khauHieu", u."danh_sach_chu_de" AS "chuDe",
             COALESCE(NULLIF(u."mo_ta_vi", ''), u."mo_ta_goc_tieng_anh") AS "moTa"
      FROM "phan_tich_ai" pa JOIN "ung_dung" u ON pa."ma_ung_dung" = u."ma_ung_dung"
      WHERE ${cot} IS NULL
      ORDER BY u."so_sao_github" DESC
    `;
    const ketQua = { conThieu: dong.length, daGhi: 0, loi: 0 };
    if (!ghi) return ketQua;

    for (const app of dong.slice(0, toiDa)) {
      // Ghép văn bản giống hệt bước phân tích (ung-dung.service) để vector hai đường khớp nhau.
      const vanBan = this.chuanBiVanBanNhung({
        tenKhoChua: app.tenKhoChua,
        slogan: app.khauHieu,
        tinhNang: app.chuDe,
        topics: app.chuDe,
        moTa: app.moTa,
      });
      try {
        const vector = await this.sinhEmbedding(vanBan, moHinh);
        await this.luuVectorNguNghia(app.maPhanTich, vector, moHinh);
        ketQua.daGhi++;
      } catch (err) {
        ketQua.loi++;
        this.logger.warn(`Bổ sung vector ${moHinh.model} lỗi: ${(err as Error).message}`);
        if ((err as Error).message.includes('hết lượt trong ngày')) break;
      }
    }
    return ketQua;
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
    for (const moHinh of MO_HINH_EMBEDDING) {
      if (!(await this.rateLimiter.giuChoEmbedding(moHinh.model))) continue;
      const vector = await this.goiEmbedding(cauTruyVan, moHinh);
      return this.timTheoCotVector(vector, moHinh, gioiHan, platform);
    }
    throw new Error('Các mô hình Embedding đều đã hết lượt trong ngày.');
  }

  /** Chỉ so vector câu tìm kiếm với cột của đúng mô hình đã sinh ra nó (cấm trộn, D-33). */
  private async timTheoCotVector(
    vector: number[],
    moHinh: MoHinhEmbedding,
    gioiHan: number,
    platform?: string,
  ): Promise<KetQuaTimKiemNguNghia[]> {
    const vectorStr = `[${vector.join(',')}]`;
    const cot = Prisma.raw(`pa."${moHinh.cot}"`);

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
        u."mo_ta_vi" AS "moTaVi",
        u."mo_ta_goc_tieng_anh" AS "moTaGocTiengAnh",
        u."ma_bam_mo_ta" AS "maBamMoTa",
        pa."khau_hieu_tieng_viet" AS "khauHieuTiengViet",
        pa."diem_uy_tin" AS "diemUyTin",
        pa."muc_do_an_toan" AS "mucDoAnToan",
        (${cot} <=> ${vectorStr}::vector) AS "khoangCach"
      FROM "phan_tich_ai" pa
      JOIN "ung_dung" u ON pa."ma_ung_dung" = u."ma_ung_dung"
      WHERE ${cot} IS NOT NULL
        AND u."trang_thai" = 'HOAT_DONG'
        ${platformCondition}
      ORDER BY ${cot} <=> ${vectorStr}::vector ASC
      LIMIT ${gioiHan}
    `;

    return locTheoNguongDoGiong(ketQua, moHinh.nguong).map((row) => ({
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
      moTaVi: row.moTaVi,
      moTaGocTiengAnh: row.moTaGocTiengAnh,
      maBamMoTa: row.maBamMoTa,
      khauHieuTiengViet: row.khauHieuTiengViet,
      diemUyTin: row.diemUyTin,
      mucDoAnToan: row.mucDoAnToan,
      doTuongDong: Math.max(0, 1 - (row.khoangCach || 0)),
    }));
  }
}
