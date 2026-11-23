import { createHash, randomBytes, randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { cauHinhUngDung } from '../src/cau-hinh-ung-dung';
import { GithubService } from '../src/modules/github/github.service';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { CacheService } from '../src/modules/redis/cache.service';
import { CACHE_PREFIX, DEFAULT_TTL } from '../src/modules/redis/redis.constants';
import { chanMoiTruongThat, githubGia, lamSachDuLieu } from './tien-ich-e2e';

/**
 * Test e2e (P2-61): gọi HTTP thật vào AppModule, chạy trên Postgres và Redis thật.
 * GitHub được thay bằng bản giả trả rỗng để test không phụ thuộc mạng và hạn mức.
 */

const REPO = 'e2e-chu/e2e-ung-dung';

async function taoUngDungMau(app: INestApplication): Promise<void> {
  await app.get(PrismaService).ungDung.create({
    data: {
      tenRepoDayDu: REPO,
      chuSoHuu: 'e2e-chu',
      tenKhoChua: 'e2e-ung-dung',
      duongDanGithub: `https://github.com/${REPO}`,
      moTaGocTiengAnh: 'A sample app for end-to-end tests',
      moTaVi: 'Ứng dụng mẫu cho test đầu cuối',
      soSaoGithub: 5000,
      loaiGiayPhep: 'MIT',
      danhMucChinh: 'Tiện ích hệ thống',
      nenTangHoTro: 'WINDOWS',
      phanTichAI: {
        create: {
          khauHieuTiengViet: 'Ứng dụng mẫu cho test đầu cuối',
          diemUyTin: 90,
          mucDoAnToan: 'AN_TOAN_CAO',
          yeuToRuiRo: [
            { ma: 'SINGLE_CONTRIBUTOR', moTa: 'Một người đóng góp.', diemTru: 10, nguon: 'LUAT' },
          ],
          huongDanCaiDat: { khongCoHuongDan: true, phienBanBocTach: 5, cachCai: [] },
        },
      },
      danhSachPhatHanh: {
        create: {
          tenPhienBan: 'v1.0.0',
          ngayPhatHanh: new Date(),
          danhSachTepCaiDat: {
            create: [
              {
                tenTep: 'e2e-ung-dung-1.0.0-portable.zip',
                duongDanTaiVe: `https://github.com/${REPO}/releases/download/v1.0.0/portable.zip`,
                dinhDangTep: 'ZIP_PORTABLE',
                kienTrucChip: 'X86_64',
                dungLuongBytes: BigInt(2048),
              },
              {
                tenTep: 'e2e-ung-dung-1.0.0-x64.msi',
                duongDanTaiVe: `https://github.com/${REPO}/releases/download/v1.0.0/x64.msi`,
                dinhDangTep: 'MSI',
                kienTrucChip: 'X86_64',
                dungLuongBytes: BigInt(4096),
              },
            ],
          },
        },
      },
    },
  });
}

/** Giả lập bước GitHub callback: tạo người dùng và mã đổi một lần kèm PKCE challenge. */
async function capMaDoi(app: INestApplication): Promise<{ code: string; verifier: string }> {
  const nguoiDung = await app.get(PrismaService).nguoiDung.create({
    data: { tenDangNhap: 'e2e-nguoi-dung', maDinhDanhGithub: 'e2e-1' },
  });
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const code = randomUUID();
  await app
    .get(CacheService)
    .set(
      `${CACHE_PREFIX.AUTH_EXCHANGE}${code}`,
      { maNguoiDung: nguoiDung.maNguoiDung, challenge },
      DEFAULT_TTL.EXCHANGE_CODE,
    );
  return { code, verifier };
}

describe('Luồng chính qua HTTP (P2-61)', () => {
  let app: INestApplication;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    chanMoiTruongThat();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GithubService)
      .useValue(githubGia)
      .compile();
    app = moduleRef.createNestApplication();
    cauHinhUngDung(app);
    await app.init();
    await lamSachDuLieu(app);
    await taoUngDungMau(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health báo DB và Redis sẵn sàng', async () => {
    const res = await api().get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ trangThai: 'HOAT_DONG', db: 'SAN_SANG', redis: 'SAN_SANG' });
  });

  it('GET /ung-dung trả danh sách phân trang có ứng dụng mẫu', async () => {
    const res = await api().get('/api/v1/ung-dung?platform=windows&limit=30').expect(200);
    expect(res.body.tongSo).toBe(1);
    expect(res.body.duLieu[0]).toMatchObject({ tenRepoDayDu: REPO });
  });

  it('GET /ung-dung/:owner/:repo trả chi tiết, điểm uy tín chỉ do luật, không còn trường Jev', async () => {
    const res = await api().get(`/api/v1/ung-dung/${REPO}?platform=windows`).expect(200);
    expect(res.body.moTaVi).toBe('Ứng dụng mẫu cho test đầu cuối');
    expect(res.body.phanTichAi.diemUyTin).toBe(90);
    expect(res.body.phanTichAi.yeuToRuiRo.every((y: { nguon: string }) => y.nguon === 'LUAT')).toBe(
      true,
    );
    expect(JSON.stringify(res.body)).not.toMatch(/jev/i);
  });

  it('GET /ung-dung/:owner/:repo không có thì 404', async () => {
    await api().get('/api/v1/ung-dung/khong-co/ung-dung-nay').expect(404);
  });

  it('GET /danh-muc đếm đúng ứng dụng theo danh mục', async () => {
    const res = await api().get('/api/v1/danh-muc?platform=windows').expect(200);
    expect(res.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ ten: 'Tiện ích hệ thống', soLuong: 1 })]),
    );
  });

  it('POST /ung-dung/giai-quyet-tai-san chọn MSI x64 trước bản ZIP bằng luật', async () => {
    const res = await api()
      .post('/api/v1/ung-dung/giai-quyet-tai-san')
      .send({ maUngDung: REPO, nenTang: 'WINDOWS', abis: ['x86_64'] })
      .expect(200);
    expect(res.body.nguonQuyetDinh).toBe('LUAT');
    expect(res.body.tepCaiDat.tenTep).toBe('e2e-ung-dung-1.0.0-x64.msi');
  });

  it('POST /ung-dung/giai-quyet-tai-san: APK tên mơ hồ thì 404 kèm danh sách cho người dùng tự chọn', async () => {
    await app.get(PrismaService).ungDung.create({
      data: {
        tenRepoDayDu: 'e2e-chu/e2e-android',
        chuSoHuu: 'e2e-chu',
        tenKhoChua: 'e2e-android',
        duongDanGithub: 'https://github.com/e2e-chu/e2e-android',
        nenTangHoTro: 'ANDROID',
        danhSachPhatHanh: {
          create: {
            tenPhienBan: 'v1.0.0',
            ngayPhatHanh: new Date(),
            danhSachTepCaiDat: {
              create: {
                tenTep: 'e2e-android-release.apk',
                duongDanTaiVe:
                  'https://github.com/e2e-chu/e2e-android/releases/download/v1.0.0/app.apk',
                dinhDangTep: 'APK',
                kienTrucChip: 'KHONG_XAC_DINH',
              },
            },
          },
        },
      },
    });
    const res = await api()
      .post('/api/v1/ung-dung/giai-quyet-tai-san')
      .send({ maUngDung: 'e2e-chu/e2e-android', nenTang: 'ANDROID', abis: ['arm64-v8a'] })
      .expect(404);
    expect(res.body.maLoi).toBe('KHONG_CO_FILE_PHU_HOP');
    expect(res.body.chiTiet.tepDeNguoiDungChon).toEqual([
      expect.objectContaining({ tenTep: 'e2e-android-release.apk' }),
    ]);
  });

  it('POST /ung-dung/giai-quyet-tai-san từ chối dữ liệu sai kiểu (ValidationPipe)', async () => {
    await api()
      .post('/api/v1/ung-dung/giai-quyet-tai-san')
      .send({ maUngDung: REPO, nenTang: 'WINDOWS', abis: 'x86_64', thuaTruong: 1 })
      .expect(400);
  });

  describe('Đăng nhập: đổi mã → gọi API cần đăng nhập → làm mới → đăng xuất', () => {
    let accessToken = '';
    let refreshToken = '';

    it('POST /xac-thuc/doi-ma đổi mã một lần lấy cặp token; dùng lại mã thì bị từ chối', async () => {
      const { code, verifier } = await capMaDoi(app);
      const thietBi = {
        dinhDanhPhanCung: 'e2e-may-1',
        tenThietBi: 'Máy test',
        loaiThietBi: 'MAY_TINH_WINDOWS',
      };
      const res = await api()
        .post('/api/v1/xac-thuc/doi-ma')
        .send({ code, verifier, thietBi })
        .expect(200);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toContain('.');

      await api().post('/api/v1/xac-thuc/doi-ma').send({ code, verifier, thietBi }).expect(400);
    });

    it('API cần đăng nhập: không có token thì 401, có token thì đọc được hồ sơ', async () => {
      await api().get('/api/v1/nguoi-dung/ho-so').expect(401);
      const res = await api()
        .get('/api/v1/nguoi-dung/ho-so')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.tenDangNhap).toBe('e2e-nguoi-dung');
    });

    it('Yêu thích: bấm một lần thì có trong danh sách, bấm lần nữa thì bỏ', async () => {
      const auth = { Authorization: `Bearer ${accessToken}` };
      await api().post(`/api/v1/ung-dung/${REPO}/yeu-thich`).set(auth).expect(200);
      let ds = await api().get('/api/v1/nguoi-dung/yeu-thich').set(auth).expect(200);
      expect(JSON.stringify(ds.body)).toContain(REPO);

      await api().post(`/api/v1/ung-dung/${REPO}/yeu-thich`).set(auth).expect(200);
      ds = await api().get('/api/v1/nguoi-dung/yeu-thich').set(auth).expect(200);
      expect(JSON.stringify(ds.body)).not.toContain(REPO);
    });

    it('POST /xac-thuc/lam-moi xoay vòng refresh token', async () => {
      const res = await api().post('/api/v1/xac-thuc/lam-moi').send({ refreshToken }).expect(200);
      expect(res.body.refreshToken).toBeTruthy();
      expect(res.body.refreshToken).not.toBe(refreshToken);
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('POST /xac-thuc/dang-xuat thu hồi phiên: refresh token cũ không dùng được nữa', async () => {
      await api()
        .post('/api/v1/xac-thuc/dang-xuat')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect((res) => expect([200, 204]).toContain(res.status));
      await api().post('/api/v1/xac-thuc/lam-moi').send({ refreshToken }).expect(401);
    });
  });
});
