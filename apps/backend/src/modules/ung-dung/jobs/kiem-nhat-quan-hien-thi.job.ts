import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DinhDangTep, Prisma } from '@prisma/client';
import { coCachCaiCliHopLe, HuongDanCaiDatDto, YeuToRuiRoItem } from '@forgestore/types';
import { tinhLaiDiemTheoThoiGian } from '../../ai/services/trust-score.service';
import { AppDescriptionTranslationService } from '../../ai/translation/services/app-description-translation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { UngDungService, daCoKetQuaBocTachCli } from '../ung-dung.service';
import { SemanticSearchService } from '../../ai/services/semantic-search.service';

/**
 * Kiểu dữ liệu thu gọn của ứng dụng phục vụ đối soát tính nhất quán trạng thái hiển thị
 */
interface UngDungDoiSoat {
  maUngDung: string;
  tenRepoDayDu: string;
  trangThai: string;
  phanTichAI?: {
    huongDanCaiDat: unknown;
  } | null;
  danhSachPhatHanh: Array<{
    danhSachTepCaiDat: Array<{ maTep: string }>;
  }>;
}

// Mỗi lần đọc một trang để không kéo hết bảng vào bộ nhớ
const KICH_THUOC_TRANG = 200;
// Chỉ in tên tối đa chừng này repo cảnh báo (b) để log không bị ngập; số lượng vẫn đếm đủ
const SO_REPO_CANH_BAO_TOI_DA_TRONG_LOG = 20;
// Mỗi đêm bóc tách lại tối đa chừng này dấu lỗi thời (c): mỗi app tốn một lần lấy README (có ETag)
const SO_BOC_TACH_LAI_TOI_DA = 100;
// Mỗi đêm sinh lại vector cho tối đa chừng này app có văn bản đổi (d): mỗi app tốn một lượt mỗi mô hình Embedding
const SO_SINH_LAI_VECTOR_TOI_DA = 100;

/**
 * Job chốt chặn tự động hằng ngày kiểm tra tính nhất quán trạng thái hiển thị (P3B-25.8, D-30).
 *
 * Nhiệm vụ:
 * 1. (a) Đang KHONG_CO_BAN_CAI nhưng có tệp cài hoặc lệnh CLI hợp lệ -> TỰ ĐỘNG SỬA sang HOAT_DONG và xóa cache.
 * 2. (b) Đang HOAT_DONG nhưng không có tệp cài và không có lệnh CLI hợp lệ -> CHỈ CẢNH BÁO trong log, không tự đổi.
 * 3. (c) P3B-25.15: dấu "không có hướng dẫn" ghi bằng bộ bóc tách cũ -> bóc tách lại, không chờ có người mở trang.
 *    Chạy trước (a) để app vừa tìm thấy lệnh cài được hiện ngay trong cùng đêm.
 * 4. (d) P3B-09.3: sinh lại vector tìm kiếm cho app có tên, mô tả đã dịch, chủ đề hay danh mục đổi.
 */
@Injectable()
export class KiemNhatQuanHienThiJob {
  private readonly logger = new Logger(KiemNhatQuanHienThiJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly appsService: UngDungService,
    private readonly semanticSearchService: SemanticSearchService,
    private readonly descriptionService: AppDescriptionTranslationService,
  ) {}

  /**
   * Chạy định kỳ vào 2:00 sáng mỗi ngày, sau job suy giảm điểm thịnh hành (nửa đêm)
   */
  // Server chạy giờ UTC: đặt múi giờ để "nửa đêm", "2:00" là giờ Việt Nam
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    this.logger.log('Bắt đầu chu kỳ quét kiểm tra tính nhất quán trạng thái hiển thị...');
    await this.kiemTraVaSuaNhatQuanHienThi();
  }

  /**
   * Quét và đối soát tính nhất quán hiển thị trên toàn bộ ứng dụng trong CSDL.
   * gioiHan là số app tối đa được tự sửa (a) trong một lần chạy.
   */
  async kiemTraVaSuaNhatQuanHienThi(
    gioiHan = 200,
  ): Promise<{ soLuongDaSua: number; soLuongCanhBao: number; soLuongBocTachLai: number }> {
    // Chống chạy chồng lấn giữa các chu kỳ cron
    if (this.isRunning) {
      this.logger.warn('Tác vụ kiểm tra nhất quán hiển thị đang chạy dở, bỏ qua chu kỳ này.');
      return { soLuongDaSua: 0, soLuongCanhBao: 0, soLuongBocTachLai: 0 };
    }

    this.isRunning = true;
    let soLuongDaSua = 0;
    let soLuongCanhBao = 0;
    let soLuongBocTachLai = 0;

    try {
      soLuongBocTachLai = await this.bocTachLaiDauLoiThoi(SO_BOC_TACH_LAI_TOI_DA);
      soLuongDaSua = await this.xuLyAppBiAnNham(gioiHan);
      soLuongCanhBao = await this.xuLyAppHienNham();
      // (e) Chạy trước (d) để vector sinh từ mô tả tiếng Việt mới ngay trong đêm
      const moTa = await this.descriptionService.dichMoTaCacApp(false);
      if (moTa.soAppCanDich > 0) {
        this.logger.log(
          `[Chốt chặn (e)] Mô tả: dịch ${moTa.dichThanhCong}/${moTa.soAppCanDich}, chờ ngày mai ${moTa.soAppChoNgayMai}.`,
        );
      }
      const vector =
        await this.semanticSearchService.sinhLaiVectorLoiThoi(SO_SINH_LAI_VECTOR_TOI_DA);
      this.logger.log(
        `[Chốt chặn (d)] Vector: ghi mốc ${vector.ghiMoc}, sinh lại ${vector.sinhLai}, lỗi ${vector.loi}.`,
      );
      const soDiemDoi = await this.tinhLaiDiemUyTinTheoThoiGian();
      if (soDiemDoi > 0) this.logger.log(`[Chốt chặn (f)] Tính lại điểm uy tín: ${soDiemDoi} app.`);

      this.logger.log(
        `[Chốt chặn hoàn tất] Bóc tách lại (c): ${soLuongBocTachLai}, tự sửa (a): ${soLuongDaSua}, cảnh báo (b): ${soLuongCanhBao}`,
      );
    } catch (error) {
      // Bắt lỗi để sự cố DB không làm sập tiến trình backend
      this.logger.error('Lỗi khi kiểm tra tính nhất quán hiển thị:', error);
    } finally {
      this.isRunning = false;
    }

    return { soLuongDaSua, soLuongCanhBao, soLuongBocTachLai };
  }

  /**
   * (c) Bóc tách lại các hướng dẫn lỗi thời: dấu "không có hướng dẫn" của bộ bóc tách cũ, và hướng dẫn còn lệnh
   * cài thư viện npm vào dự án (luật cũ nhận nhầm, xem `daCoKetQuaBocTachCli`).
   * Dùng đúng đường bổ sung của trang chi tiết (`phanTichUngDung`), nên có khóa chống chạy trùng và tự xóa cache.
   */
  private async bocTachLaiDauLoiThoi(gioiHan: number): Promise<number> {
    // Chỉ đọc đúng hai nhóm có thể lỗi thời (không kéo hết cột JSON của mọi app mỗi đêm): dấu "không có hướng dẫn",
    // và hướng dẫn còn lệnh npm/yarn/pnpm/bun (luật JS `daCoKetQuaBocTachCli` quyết định cuối cùng)
    const [dauKhongCo, coLenhNpm] = await Promise.all([
      this.prisma.phanTichAI.findMany({
        where: { huongDanCaiDat: { path: ['khongCoHuongDan'], equals: true } },
        select: { maUngDung: true, huongDanCaiDat: true },
      }),
      this.prisma.$queryRaw<Array<{ maUngDung: string; huongDanCaiDat: unknown }>>`
        SELECT "ma_ung_dung" AS "maUngDung", "huong_dan_cai_dat" AS "huongDanCaiDat"
        FROM "phan_tich_ai"
        WHERE "huong_dan_cai_dat"::text ~ '"lenh": "(npm|pnpm|yarn|bun) '`,
    ]);
    // Gộp hai nhóm theo mã app (một app chỉ bóc một lần), rồi giữ những hướng dẫn thật sự lỗi thời
    const theoMaApp = new Map([...dauKhongCo, ...(coLenhNpm ?? [])].map((p) => [p.maUngDung, p]));
    const loiThoi = [...theoMaApp.values()]
      .filter((p) => !daCoKetQuaBocTachCli(p.huongDanCaiDat))
      .slice(0, gioiHan);
    for (const p of loiThoi) await this.appsService.phanTichUngDung(p.maUngDung);
    if (loiThoi.length > 0) {
      this.logger.log(
        `[Chốt chặn (c)] Đã bóc tách lại ${loiThoi.length} dấu "không có hướng dẫn" cũ.`,
      );
    }
    return loiThoi.length;
  }

  /**
   * (a) Xử lý ứng dụng đang KHONG_CO_BAN_CAI nhưng thực tế đủ điều kiện hiển thị.
   * Duyệt theo trang (không chỉ 200 dòng đầu) để dòng không đủ điều kiện không chặn các dòng phía sau.
   */
  private async xuLyAppBiAnNham(gioiHan: number): Promise<number> {
    let daSua = 0;
    let conTro: string | undefined;

    try {
      while (daSua < gioiHan) {
        const trang = await this.layTrangAppTheoTrangThai('KHONG_CO_BAN_CAI', conTro);
        for (const app of trang) {
          if (daSua >= gioiHan) break;
          if (await this.suaAppBiAnNham(app)) daSua++;
        }
        const dongCuoi = trang.at(-1);
        if (!dongCuoi || trang.length < KICH_THUOC_TRANG) break;
        conTro = dongCuoi.maUngDung;
      }
    } finally {
      // Xóa cache kể cả khi lỗi giữa chừng, vì các app đã sửa trước đó cần hiện ngay
      if (daSua > 0) await this.xoaCacheHienThi();
    }

    return daSua;
  }

  /**
   * Đổi một app đang bị ẩn nhầm sang HOAT_DONG nếu có tệp cài hoặc lệnh CLI hợp lệ (D-30)
   */
  private async suaAppBiAnNham(app: UngDungDoiSoat): Promise<boolean> {
    const coTep = this.coTepCaiWindowsHoacAndroid(app.danhSachPhatHanh);
    const coCli = this.coHuongDanCliHopLe(app.phanTichAI?.huongDanCaiDat);
    if (!coTep && !coCli) return false;

    await this.prisma.ungDung.update({
      where: { maUngDung: app.maUngDung },
      data: { trangThai: 'HOAT_DONG' },
    });

    this.logger.log(
      `[Chốt chặn (a)] Tự sửa trạng thái repo [${app.tenRepoDayDu}]: KHONG_CO_BAN_CAI -> HOAT_DONG (Tệp: ${coTep}, CLI: ${coCli})`,
    );
    return true;
  }

  /**
   * (b) Xử lý ứng dụng đang HOAT_DONG nhưng không có tệp cài và không có lệnh CLI.
   * Chỉ cảnh báo, không tự đổi trạng thái vì có thể là lỗi dữ liệu cần người xem.
   */
  private async xuLyAppHienNham(): Promise<number> {
    let canhBao = 0;
    let conTro: string | undefined;

    for (;;) {
      const trang = await this.layTrangAppTheoTrangThai('HOAT_DONG', conTro);
      for (const app of trang) {
        if (!this.laAppHienNham(app)) continue;
        canhBao++;
        if (canhBao <= SO_REPO_CANH_BAO_TOI_DA_TRONG_LOG) {
          this.logger.warn(
            `[Chốt chặn (b)] Cảnh báo: Repo [${app.tenRepoDayDu}] đang HOAT_DONG nhưng không có tệp cài và không có hướng dẫn CLI hợp lệ.`,
          );
        }
      }
      const dongCuoi = trang.at(-1);
      if (!dongCuoi || trang.length < KICH_THUOC_TRANG) break;
      conTro = dongCuoi.maUngDung;
    }

    if (canhBao > SO_REPO_CANH_BAO_TOI_DA_TRONG_LOG) {
      this.logger.warn(
        `[Chốt chặn (b)] ... và ${canhBao - SO_REPO_CANH_BAO_TOI_DA_TRONG_LOG} repo cảnh báo khác chưa liệt kê tên.`,
      );
    }
    return canhBao;
  }

  /**
   * App đang hiện mà không có tệp cài lẫn lệnh CLI hợp lệ
   */
  private laAppHienNham(app: UngDungDoiSoat): boolean {
    return (
      !this.coTepCaiWindowsHoacAndroid(app.danhSachPhatHanh) &&
      !this.coHuongDanCliHopLe(app.phanTichAI?.huongDanCaiDat)
    );
  }

  /**
   * Lấy một trang app theo trạng thái (sắp theo mã, phân trang bằng con trỏ), kèm tệp cài và hướng dẫn CLI.
   * Dùng "mã lớn hơn con trỏ" thay vì skip để vẫn đúng khi trạng thái các dòng đã đọc bị đổi.
   */
  private async layTrangAppTheoTrangThai(
    trangThai: string,
    conTro?: string,
  ): Promise<UngDungDoiSoat[]> {
    return this.prisma.ungDung.findMany({
      where: { trangThai, ...(conTro ? { maUngDung: { gt: conTro } } : {}) },
      orderBy: { maUngDung: 'asc' },
      take: KICH_THUOC_TRANG,
      select: {
        maUngDung: true,
        tenRepoDayDu: true,
        trangThai: true,
        phanTichAI: {
          select: {
            huongDanCaiDat: true,
          },
        },
        danhSachPhatHanh: {
          select: {
            danhSachTepCaiDat: {
              where: {
                dinhDangTep: {
                  in: [DinhDangTep.EXE, DinhDangTep.MSI, DinhDangTep.ZIP_PORTABLE, DinhDangTep.APK],
                },
              },
              select: { maTep: true },
              take: 1,
            },
          },
        },
      },
    });
  }

  /**
   * (f) Điểm uy tín tính một lần lúc phân tích; repo bị lưu trữ hay lâu không push sau đó thì điểm phải đổi theo.
   * Chỉ đọc CSDL (cờ lưu trữ do job quét giữ, ngày push do bộ theo dõi giữ), chỉ ghi dòng có điểm hoặc yếu tố đổi.
   */
  private async tinhLaiDiemUyTinTheoThoiGian(): Promise<number> {
    const ds = await this.prisma.phanTichAI.findMany({
      select: {
        maPhanTich: true,
        maUngDung: true,
        diemUyTin: true,
        yeuToRuiRo: true,
        ungDung: { select: { daLuuTru: true, pushedAt: true } },
      },
    });
    let soDoi = 0;
    for (const pt of ds) {
      const yeuToCu = (Array.isArray(pt.yeuToRuiRo)
        ? pt.yeuToRuiRo
        : []) as unknown as YeuToRuiRoItem[];
      const moi = tinhLaiDiemTheoThoiGian(yeuToCu, pt.ungDung.daLuuTru, pt.ungDung.pushedAt);
      const maCu = yeuToCu
        .map((yt) => yt.ma)
        .sort()
        .join(',');
      const maMoi = moi.yeuToRuiRo
        .map((yt) => yt.ma)
        .sort()
        .join(',');
      if (moi.diemUyTin === pt.diemUyTin && maCu === maMoi) continue;
      await this.prisma.phanTichAI.update({
        where: { maPhanTich: pt.maPhanTich },
        data: {
          diemUyTin: moi.diemUyTin,
          mucDoAnToan: moi.mucDoAnToan,
          yeuToRuiRo: moi.yeuToRuiRo as unknown as Prisma.InputJsonValue,
        },
      });
      soDoi++;
    }
    if (soDoi > 0) await this.xoaCacheHienThi();
    return soDoi;
  }

  /**
   * Kiểm tra xem các bản phát hành có tệp cài đặt Windows hoặc Android không
   */
  private coTepCaiWindowsHoacAndroid(
    danhSachPhatHanh: Array<{ danhSachTepCaiDat: Array<{ maTep: string }> }>,
  ): boolean {
    return danhSachPhatHanh.some((ph) => ph.danhSachTepCaiDat.length > 0);
  }

  /**
   * Kiểm tra xem hướng dẫn cài đặt có lệnh CLI hợp lệ không
   */
  private coHuongDanCliHopLe(huongDanCaiDat: unknown): boolean {
    return coCachCaiCliHopLe(huongDanCaiDat as HuongDanCaiDatDto | null | undefined);
  }

  /**
   * Xóa sạch cache danh sách, chi tiết app và danh mục để giao diện nhận trạng thái mới ngay
   */
  private async xoaCacheHienThi(): Promise<void> {
    await this.cacheService.xoaTheoPrefix('fs:apps:list:');
    await this.cacheService.xoaTheoPrefix('fs:apps:detail:');
    await this.cacheService.xoaTheoPrefix('fs:categories:');
  }
}
