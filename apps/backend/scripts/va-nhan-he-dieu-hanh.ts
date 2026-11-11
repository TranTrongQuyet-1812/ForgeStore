import { NestFactory } from '@nestjs/core';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Định nghĩa cấu trúc JSON của huongDanCaiDat trong CSDL.
 */
export interface DuLieuHuongDanCaiDat {
  nguon?: string;
  cachCai: Array<{
    ten?: string;
    nhom: string;
    heDieuHanh: string;
    phanCung?: string;
    yeuCau?: string[];
    buoc: Array<{
      moTa?: string;
      lenh: string;
      ruiRoCao?: boolean;
      canhBaoRuiRo?: string;
    }>;
    trinhQuanLy?: string;
    tenGoi?: string;
    lenhCapNhat?: string;
    lenhGo?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

/**
 * Mục dữ liệu vá nhãn hệ điều hành cho một cách cài đặt.
 */
export interface MucVaNhan {
  repo: string;
  nhom: string;
  lenh: string;
  db: string;
  moi: string;
}

/**
 * Mục dữ liệu trong tệp hoàn tác (rollback).
 */
export interface MucHoanTac {
  repo: string;
  nhom: string;
  lenh: string;
  nhanCu: string;
  nhanDaGhi: string;
}

/**
 * Kết quả xử lý vá cho một đối tượng JSON hướng dẫn cài đặt.
 */
export interface KetQuaVaHuongDan {
  daThayDoi: boolean;
  huongDanMoi: DuLieuHuongDanCaiDat | null;
  cacCachCaiDaVa: Array<{
    nhom: string;
    lenh: string;
    nhanCu: string;
    nhanMoi: string;
  }>;
  cacMucBoQua: Array<{
    nhom: string;
    lenh: string;
    lyDo: string;
  }>;
}

/**
 * Chuẩn hóa lệnh đầu để ghép: rút gọn khoảng trắng, 50 ký tự đầu, chữ thường.
 * Giống logic ghép lech_nhan của Claude.
 */
export function chuanHoaLenhDau(lenh: string): string {
  if (!lenh || typeof lenh !== 'string') return '';
  return lenh.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 50);
}

/**
 * Tạo khóa ghép cho cách cài đặt từ nhóm và lệnh đầu.
 */
export function taoKhoaGhep(nhom: string, lenhDau: string): string {
  const n = (nhom || '').trim().toUpperCase();
  const l = chuanHoaLenhDau(lenhDau);
  return `${n}::${l}`;
}

/**
 * Vá trường heDieuHanh của các cách cài đặt trong JSON huongDanCaiDat.
 * Chỉ đổi trường heDieuHanh, giữ nguyên thứ tự, tên gói, lệnh, và các trường khác.
 * Chỉ vá khi nhãn hiện tại trong DB đúng bằng mục.db.
 */
export function vaHuongDanCaiDat(
  huongDanHienTai: unknown,
  danhSachVa: MucVaNhan[],
): KetQuaVaHuongDan {
  const hd = huongDanHienTai as DuLieuHuongDanCaiDat | null | undefined;
  if (!hd || !Array.isArray(hd.cachCai) || hd.cachCai.length === 0) {
    return {
      daThayDoi: false,
      huongDanMoi: hd || null,
      cacCachCaiDaVa: [],
      cacMucBoQua: danhSachVa.map((m) => ({
        nhom: m.nhom,
        lenh: m.lenh,
        lyDo: 'Ứng dụng không có danh sách cách cài đặt trong CSDL',
      })),
    };
  }

  // Tạo map tra cứu mục vá theo khóa ghép
  const mapVa = new Map<string, MucVaNhan>();
  for (const m of danhSachVa) {
    const key = taoKhoaGhep(m.nhom, m.lenh);
    mapVa.set(key, m);
  }

  const huongDanMoi: DuLieuHuongDanCaiDat = JSON.parse(JSON.stringify(hd));
  const cacCachCaiDaVa: Array<{
    nhom: string;
    lenh: string;
    nhanCu: string;
    nhanMoi: string;
  }> = [];
  const cacMucBoQua: Array<{
    nhom: string;
    lenh: string;
    lyDo: string;
  }> = [];
  const cacKhoaDaGhep = new Set<string>();

  for (const cach of huongDanMoi.cachCai) {
    const lenhDau = cach.buoc?.[0]?.lenh || '';
    const key = taoKhoaGhep(cach.nhom, lenhDau);
    const mucVa = mapVa.get(key);

    if (mucVa) {
      cacKhoaDaGhep.add(key);
      const nhanHienTai = cach.heDieuHanh;
      if (nhanHienTai === mucVa.db) {
        cach.heDieuHanh = mucVa.moi;
        cacCachCaiDaVa.push({
          nhom: cach.nhom,
          lenh: lenhDau,
          nhanCu: nhanHienTai,
          nhanMoi: mucVa.moi,
        });
      } else {
        cacMucBoQua.push({
          nhom: cach.nhom,
          lenh: lenhDau,
          lyDo: `Nhãn hiện tại trong CSDL là '${nhanHienTai}', khác nhãn dự kiến '${mucVa.db}'`,
        });
      }
    }
  }

  // Kiểm tra những mục vá không ghép được với bất kỳ cách cài nào
  for (const m of danhSachVa) {
    const key = taoKhoaGhep(m.nhom, m.lenh);
    if (!cacKhoaDaGhep.has(key)) {
      cacMucBoQua.push({
        nhom: m.nhom,
        lenh: m.lenh,
        lyDo: 'Không tìm thấy cách cài đặt khớp trong CSDL',
      });
    }
  }

  return {
    daThayDoi: cacCachCaiDaVa.length > 0,
    huongDanMoi,
    cacCachCaiDaVa,
    cacMucBoQua,
  };
}

/**
 * Hoàn tác nhãn hệ điều hành từ danh sách hoàn tác.
 */
export function hoanTacHuongDanCaiDat(
  huongDanHienTai: unknown,
  danhSachHoanTac: MucHoanTac[],
): KetQuaVaHuongDan {
  const danhSachVa: MucVaNhan[] = danhSachHoanTac.map((ht) => ({
    repo: ht.repo,
    nhom: ht.nhom,
    lenh: ht.lenh,
    db: ht.nhanDaGhi,
    moi: ht.nhanCu,
  }));
  return vaHuongDanCaiDat(huongDanHienTai, danhSachVa);
}

/**
 * Đọc tệp đầu vào JSON (hỗ trợ mảng phẳng hoặc object có trường lechMau).
 */
export function docTepDauVao(duongDan: string): MucVaNhan[] {
  if (!fs.existsSync(duongDan)) {
    throw new Error(`Không tìm thấy tệp đầu vào tại: ${duongDan}`);
  }
  const raw = fs.readFileSync(duongDan, 'utf8');
  const parsed = JSON.parse(raw);
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.lechMau)
      ? parsed.lechMau
      : [];

  const ketQua: MucVaNhan[] = [];
  for (const item of items) {
    if (item && typeof item === 'object') {
      const it = item as Record<string, unknown>;
      if (it.repo && it.nhom && it.moi) {
        ketQua.push({
          repo: String(it.repo).trim(),
          nhom: String(it.nhom).trim(),
          lenh: String(it.lenh || '').trim(),
          db: String(it.db || '').trim(),
          moi: String(it.moi).trim(),
        });
      }
    }
  }
  return ketQua;
}

export interface PrismaClientToiThieu {
  ungDung: {
    findMany: (args: {
      where?: { tenRepoDayDu?: { in?: string[] } };
      select?: {
        maUngDung?: boolean;
        tenRepoDayDu?: boolean;
        phanTichAI?: {
          select?: {
            maPhanTich?: boolean;
            huongDanCaiDat?: boolean;
          };
        };
      };
    }) => Promise<
      Array<{
        maUngDung: string;
        tenRepoDayDu: string;
        phanTichAI: {
          maPhanTich: string;
          huongDanCaiDat: unknown;
        } | null;
      }>
    >;
  };
  phanTichAI: {
    update: (args: {
      where: { maUngDung: string };
      data: { huongDanCaiDat: unknown };
    }) => Promise<unknown>;
  };
  $transaction: (
    cb: (tx: {
      phanTichAI: {
        update: (args: {
          where: { maUngDung: string };
          data: { huongDanCaiDat: unknown };
        }) => Promise<unknown>;
      };
    }) => Promise<unknown>,
  ) => Promise<unknown>;
}

/**
 * Hàm phân tích và thực thi chính của script vá nhãn.
 */
export async function thucThiVaNhan(
  prisma: PrismaClientToiThieu,
  options: {
    duongDanTep: string;
    coGhi: boolean;
    laHoanTac?: boolean;
    duongDanRollbackTuyChon?: string;
  },
) {
  const { duongDanTep, coGhi, laHoanTac } = options;

  console.info('===========================================================');
  console.info(
    laHoanTac
      ? '🔄 BẮT ĐẦU HOÀN TÁC NHÃN HỆ ĐIỀU HÀNH TRONG CSDL'
      : '🛠️  BẮT ĐẦU VÁ NHÃN HỆ ĐIỀU HÀNH TRONG CSDL (P3B-35 & D-40)',
  );
  console.info('===========================================================');
  console.info(
    `Chế độ: ${coGhi ? '⚡ GHI VÀO CSDL (TRANSACTION)' : '🔍 CHẠY THỬ / DRY-RUN (CHỈ ĐỌC)'}`,
  );
  console.info(`Tệp đầu vào: ${duongDanTep}`);

  let danhSachVa: MucVaNhan[] = [];
  if (laHoanTac) {
    if (!fs.existsSync(duongDanTep)) {
      throw new Error(`Không tìm thấy tệp hoàn tác tại: ${duongDanTep}`);
    }
    const rawHt = JSON.parse(fs.readFileSync(duongDanTep, 'utf8'));
    const itemsHt: MucHoanTac[] = Array.isArray(rawHt) ? rawHt : [];
    danhSachVa = itemsHt.map((it) => ({
      repo: it.repo,
      nhom: it.nhom,
      lenh: it.lenh,
      db: it.nhanDaGhi,
      moi: it.nhanCu,
    }));
  } else {
    danhSachVa = docTepDauVao(duongDanTep);
  }

  console.info(`Đã nạp ${danhSachVa.length} mục cần xử lý.`);
  if (danhSachVa.length === 0) {
    console.info('Không có mục nào để xử lý.');
    return { soAppDaGhi: 0, soCachCaiDaVa: 0, tongSoMuc: 0 };
  }

  // Gom nhóm các mục theo repo
  const mapTheoRepo = new Map<string, MucVaNhan[]>();
  for (const item of danhSachVa) {
    const list = mapTheoRepo.get(item.repo) || [];
    list.push(item);
    mapTheoRepo.set(item.repo, list);
  }
  const danhSachTenRepo = Array.from(mapTheoRepo.keys());
  console.info(`Tổng số ứng dụng liên quan: ${danhSachTenRepo.length}`);

  // Chỉ SELECT các ứng dụng liên quan
  const danhSachApp = await prisma.ungDung.findMany({
    where: {
      tenRepoDayDu: { in: danhSachTenRepo },
    },
    select: {
      maUngDung: true,
      tenRepoDayDu: true,
      phanTichAI: {
        select: {
          maPhanTich: true,
          huongDanCaiDat: true,
        },
      },
    },
  });

  const mapAppDb = new Map<string, (typeof danhSachApp)[0]>();
  for (const app of danhSachApp) {
    mapAppDb.set(app.tenRepoDayDu.toLowerCase(), app);
  }

  let tongCachCaiDuKienVa = 0;
  let tongCachCaiBoQua = 0;
  const thongKeHuongDoi: Record<string, number> = {};
  const danhSachGhiKhaiThac: Array<{
    maUngDung: string;
    tenRepoDayDu: string;
    huongDanMoi: DuLieuHuongDanCaiDat | null;
    daVa: Array<{ nhom: string; lenh: string; nhanCu: string; nhanMoi: string }>;
  }> = [];

  const danhSachRollbackLuuTep: MucHoanTac[] = [];

  for (const [repo, cacMuc] of mapTheoRepo.entries()) {
    const appDb = mapAppDb.get(repo.toLowerCase());
    if (!appDb || !appDb.phanTichAI?.huongDanCaiDat) {
      console.warn(`⚠️ [${repo}]: Không tìm thấy ứng dụng hoặc chưa có huongDanCaiDat trong CSDL.`);
      tongCachCaiBoQua += cacMuc.length;
      continue;
    }

    const resVa = vaHuongDanCaiDat(appDb.phanTichAI.huongDanCaiDat, cacMuc);

    if (resVa.daThayDoi) {
      tongCachCaiDuKienVa += resVa.cacCachCaiDaVa.length;
      danhSachGhiKhaiThac.push({
        maUngDung: appDb.maUngDung,
        tenRepoDayDu: appDb.tenRepoDayDu,
        huongDanMoi: resVa.huongDanMoi,
        daVa: resVa.cacCachCaiDaVa,
      });

      for (const v of resVa.cacCachCaiDaVa) {
        const huong = `${v.nhanCu} → ${v.nhanMoi}`;
        thongKeHuongDoi[huong] = (thongKeHuongDoi[huong] || 0) + 1;

        danhSachRollbackLuuTep.push({
          repo: appDb.tenRepoDayDu,
          nhom: v.nhom,
          lenh: v.lenh,
          nhanCu: v.nhanCu,
          nhanDaGhi: v.nhanMoi,
        });
      }
    }

    if (resVa.cacMucBoQua.length > 0) {
      tongCachCaiBoQua += resVa.cacMucBoQua.length;
      for (const bq of resVa.cacMucBoQua) {
        console.warn(`  [Bỏ qua - ${repo}] ${bq.nhom} ("${bq.lenh.slice(0, 30)}..."): ${bq.lyDo}`);
      }
    }
  }

  console.info('\n--- KẾT QUẢ TỔNG QUAN ---');
  console.info(`Số ứng dụng có cách cài đặt cần vá: ${danhSachGhiKhaiThac.length}`);
  console.info(`Số cách cài đặt hợp lệ sẽ vá: ${tongCachCaiDuKienVa}`);
  console.info(`Số mục bỏ qua hoặc không khớp: ${tongCachCaiBoQua}`);
  console.info('\nThống kê hướng đổi nhãn:');
  for (const [huong, soLuong] of Object.entries(thongKeHuongDoi)) {
    console.info(`  • ${huong}: ${soLuong}`);
  }

  // In mẫu 5 mục tiêu biểu
  if (danhSachRollbackLuuTep.length > 0) {
    console.info('\nMẫu các mục sẽ cập nhật (tối đa 5 mục):');
    for (const m of danhSachRollbackLuuTep.slice(0, 5)) {
      console.info(
        `  - [${m.repo}] ${m.nhom}: ${m.nhanCu} → ${m.nhanDaGhi} ("${chuanHoaLenhDau(m.lenh)}")`,
      );
    }
  }

  // Nếu không có cờ --ghi thì dừng ở đây
  if (!coGhi) {
    console.info('\n💡 [DRY-RUN]: Đây là bản in kế hoạch. CSDL KHÔNG hề bị thay đổi.');
    console.info('Để thực thi ghi vào CSDL, chạy lại với tham số: --ghi');
    return {
      soAppDaGhi: 0,
      soCachCaiDaVa: tongCachCaiDuKienVa,
      tongSoMuc: danhSachVa.length,
    };
  }

  // Khi có cờ --ghi:
  // 1. Lưu tệp hoàn tác trước khi ghi
  const dirGoc = path.dirname(duongDanTep);
  const tenTepGoc = path.basename(duongDanTep, path.extname(duongDanTep));
  const thoiGian = new Date().toISOString().replace(/[:.]/g, '-');
  const duongDanRollback =
    options.duongDanRollbackTuyChon || path.join(dirGoc, `hoan-tac-${tenTepGoc}-${thoiGian}.json`);

  fs.writeFileSync(duongDanRollback, JSON.stringify(danhSachRollbackLuuTep, null, 2), 'utf8');
  console.info(`\n💾 Đã lưu tệp hoàn tác tại: ${duongDanRollback}`);

  // 2. Ghi từng app trong transaction
  console.info('\n⚡ Bắt đầu ghi CSDL theo từng giao dịch ứng dụng...');
  let daGhiThanhCong = 0;
  for (const item of danhSachGhiKhaiThac) {
    await prisma.$transaction(async (tx) => {
      await tx.phanTichAI.update({
        where: { maUngDung: item.maUngDung },
        data: {
          huongDanCaiDat: item.huongDanMoi,
        },
      });
    });
    daGhiThanhCong++;
  }

  console.info(`\n✅ HOÀN TẤT: Đã ghi thành công ${daGhiThanhCong} ứng dụng vào CSDL.`);
  console.info(`Tổng số cách cài đặt đã vá nhãn: ${tongCachCaiDuKienVa}`);
  console.info(
    `Nếu cần trả lại trạng thái cũ, chạy: pnpm ts-node scripts/va-nhan-he-dieu-hanh.ts --hoan-tac "${duongDanRollback}" --ghi`,
  );

  return {
    soAppDaGhi: daGhiThanhCong,
    soCachCaiDaVa: tongCachCaiDuKienVa,
    tongSoMuc: danhSachVa.length,
    duongDanRollback,
  };
}

/**
 * Điểm vào CLI của script
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.info(`
Sử dụng: pnpm tsx scripts/va-nhan-he-dieu-hanh.ts [tùy chọn]

Tùy chọn:
  --tep <đường dẫn>       Đường dẫn tệp JSON chứa danh sách vá nhãn (mảng { repo, nhom, lenh, db, moi })
  --ghi                   Thực hiện ghi thay đổi vào CSDL (mặc định chỉ in kế hoạch / dry-run)
  --hoan-tac <đường dẫn>  Hoàn tác nhãn CSDL theo tệp rollback đã lưu trước đó
  --help, -h              Hiển thị hướng dẫn này

Ví dụ:
  # Chạy thử kiểm tra kế hoạch (chỉ đọc SELECT):
  pnpm tsx scripts/va-nhan-he-dieu-hanh.ts --tep "E:/Du_An_Ca_Nhan/BaocaoForgeStore/Ra_nhan_DB_11-11/lech_nhan.json"

  # Thực thi ghi CSDL thật:
  pnpm tsx scripts/va-nhan-he-dieu-hanh.ts --tep "E:/Du_An_Ca_Nhan/BaocaoForgeStore/Ra_nhan_DB_11-11/lech_nhan.json" --ghi

  # Hoàn tác trạng thái cũ:
  pnpm tsx scripts/va-nhan-he-dieu-hanh.ts --hoan-tac "duong-dan-hoan-tac.json" --ghi
    `);
    return;
  }

  const idxTep = args.indexOf('--tep');
  const idxHoanTac = args.indexOf('--hoan-tac');
  const coGhi = args.includes('--ghi');

  let duongDanTep = '';
  let laHoanTac = false;

  if (idxHoanTac !== -1 && args[idxHoanTac + 1]) {
    duongDanTep = path.resolve(args[idxHoanTac + 1]);
    laHoanTac = true;
  } else if (idxTep !== -1 && args[idxTep + 1]) {
    duongDanTep = path.resolve(args[idxTep + 1]);
  } else {
    console.error('Lỗi: Cần cung cấp --tep <đường dẫn> hoặc --hoan-tac <đường dẫn tệp rollback>');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);

  try {
    await thucThiVaNhan(prisma, {
      duongDanTep,
      coGhi,
      laHoanTac,
    });
  } finally {
    await app.close();
  }
}

// Chạy trực tiếp khi file được gọi qua CLI
if (require.main === module || process.argv[1]?.includes('va-nhan-he-dieu-hanh')) {
  main().catch((err) => {
    console.error('Lỗi nghiêm trọng khi thực thi script:', err);
    process.exit(1);
  });
}
