import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  chuanHoaLenhDau,
  taoKhoaGhep,
  vaHuongDanCaiDat,
  hoanTacHuongDanCaiDat,
  thucThiVaNhan,
  MucVaNhan,
  MucHoanTac,
} from './va-nhan-he-dieu-hanh';

describe('va-nhan-he-dieu-hanh script (P3B-35 & D-40)', () => {
  const thuMucTam = path.join(__dirname, 'tmp-test-va-nhan');

  beforeEach(() => {
    if (!fs.existsSync(thuMucTam)) {
      fs.mkdirSync(thuMucTam, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(thuMucTam)) {
      fs.rmSync(thuMucTam, { recursive: true, force: true });
    }
  });

  describe('1. Hàm chuẩn hóa lệnh đầu và tạo khóa ghép', () => {
    it('chuẩn hóa khoảng trắng, chữ thường và cắt tối đa 50 ký tự', () => {
      const lenh = '   CURL  -fsSL   https://superfile.dev/install.sh   |  bash   ';
      const chuanHoa = chuanHoaLenhDau(lenh);
      expect(chuanHoa).toBe('curl -fssl https://superfile.dev/install.sh | bash');
      expect(chuanHoa.length).toBeLessThanOrEqual(50);

      const lenhDai =
        'curl -fsSL https://my-very-long-domain-name.example.com/very/long/path/install.sh | sh';
      const chuanHoaDai = chuanHoaLenhDau(lenhDai);
      expect(chuanHoaDai.length).toBe(50);
      expect(chuanHoaDai).toBe(lenhDai.slice(0, 50).toLowerCase());
    });

    it('tạo khóa ghép dạng NHOM::lenh_dau', () => {
      const key = taoKhoaGhep('nguon', '  curl -fsSL https://example.com/install.sh  ');
      expect(key).toBe('NGUON::curl -fssl https://example.com/install.sh');
    });

    it('xử lý an toàn khi lệnh null/undefined hoặc rỗng', () => {
      expect(chuanHoaLenhDau('')).toBe('');
      expect(chuanHoaLenhDau(null as any)).toBe('');
      expect(taoKhoaGhep('PIP', '')).toBe('PIP::');
    });
  });

  describe('2. Hàm vaHuongDanCaiDat', () => {
    const huongDanMau = {
      nguon: 'README',
      cachCai: [
        {
          ten: 'Cài đặt qua PIP',
          nhom: 'PIP',
          heDieuHanh: 'LINUX_MAC',
          buoc: [{ lenh: 'pip install my-tool' }],
          trinhQuanLy: 'pip',
          tenGoi: 'my-tool',
        },
        {
          ten: 'Cài đặt qua NGUON',
          nhom: 'NGUON',
          heDieuHanh: 'DUNG_CHUNG',
          buoc: [{ lenh: 'curl -fsSL https://my-tool.org/install.sh | sh' }],
          trinhQuanLy: undefined,
          tenGoi: undefined,
        },
      ],
    };

    it('vá thành công khi nhãn hiện tại khớp đúng nhãn db trong danh sách vá', () => {
      const danhSachVa: MucVaNhan[] = [
        {
          repo: 'owner/my-tool',
          nhom: 'PIP',
          lenh: 'pip install my-tool',
          db: 'LINUX_MAC',
          moi: 'DUNG_CHUNG',
        },
      ];

      const res = vaHuongDanCaiDat(huongDanMau, danhSachVa);
      expect(res.daThayDoi).toBe(true);
      expect(res.cacCachCaiDaVa.length).toBe(1);
      expect(res.cacCachCaiDaVa[0]).toEqual({
        nhom: 'PIP',
        lenh: 'pip install my-tool',
        nhanCu: 'LINUX_MAC',
        nhanMoi: 'DUNG_CHUNG',
      });
      expect(res.huongDanMoi.cachCai[0].heDieuHanh).toBe('DUNG_CHUNG');
      // Giữ nguyên các thông tin khác của cách cài
      expect(res.huongDanMoi.cachCai[0].tenGoi).toBe('my-tool');
      expect(res.huongDanMoi.cachCai[1].heDieuHanh).toBe('DUNG_CHUNG'); // Cách cài thứ hai không bị đụng tới
    });

    it('bỏ qua và cảnh báo khi nhãn hiện tại trong CSDL bị lệch với nhãn db mong đợi', () => {
      const danhSachVa: MucVaNhan[] = [
        {
          repo: 'owner/my-tool',
          nhom: 'PIP',
          lenh: 'pip install my-tool',
          db: 'WINDOWS', // Mong đợi WINDOWS nhưng CSDL thực tế đang là LINUX_MAC
          moi: 'DUNG_CHUNG',
        },
      ];

      const res = vaHuongDanCaiDat(huongDanMau, danhSachVa);
      expect(res.daThayDoi).toBe(false);
      expect(res.cacCachCaiDaVa.length).toBe(0);
      expect(res.cacMucBoQua.length).toBe(1);
      expect(res.cacMucBoQua[0].lyDo).toContain("khác nhãn dự kiến 'WINDOWS'");
      expect(res.huongDanMoi.cachCai[0].heDieuHanh).toBe('LINUX_MAC'); // Không đổi
    });

    it('báo bỏ qua khi không tìm thấy cách cài phù hợp để ghép', () => {
      const danhSachVa: MucVaNhan[] = [
        {
          repo: 'owner/my-tool',
          nhom: 'CARGO',
          lenh: 'cargo install my-tool',
          db: 'LINUX_MAC',
          moi: 'DUNG_CHUNG',
        },
      ];

      const res = vaHuongDanCaiDat(huongDanMau, danhSachVa);
      expect(res.daThayDoi).toBe(false);
      expect(res.cacMucBoQua.length).toBe(1);
      expect(res.cacMucBoQua[0].lyDo).toContain('Không tìm thấy cách cài đặt');
    });
  });

  describe('3. Hàm hoanTacHuongDanCaiDat', () => {
    it('khôi phục lại nhãn cũ từ danh sách hoàn tác', () => {
      const huongDanDaVa = {
        cachCai: [
          {
            nhom: 'PIP',
            heDieuHanh: 'DUNG_CHUNG',
            buoc: [{ lenh: 'pip install my-tool' }],
          },
        ],
      };

      const danhSachHoanTac: MucHoanTac[] = [
        {
          repo: 'owner/my-tool',
          nhom: 'PIP',
          lenh: 'pip install my-tool',
          nhanCu: 'LINUX_MAC',
          nhanDaGhi: 'DUNG_CHUNG',
        },
      ];

      const res = hoanTacHuongDanCaiDat(huongDanDaVa, danhSachHoanTac);
      expect(res.daThayDoi).toBe(true);
      expect(res.huongDanMoi.cachCai[0].heDieuHanh).toBe('LINUX_MAC');
      expect(res.cacCachCaiDaVa[0].nhanMoi).toBe('LINUX_MAC');
    });
  });

  describe('4. Quy trình thucThiVaNhan với Mock DB (DB giả)', () => {
    const duongDanTepInput = path.join(thuMucTam, 'dau-vao.json');
    const mockAppDb = {
      maUngDung: 'uuid-1234',
      tenRepoDayDu: 'astral-sh/uv',
      phanTichAI: {
        maPhanTich: 'uuid-pt-5678',
        huongDanCaiDat: {
          cachCai: [
            {
              nhom: 'NGUON',
              heDieuHanh: 'LINUX_MAC',
              buoc: [{ lenh: 'curl -LsSf https://astral.sh/uv/install.sh | sh' }],
            },
          ],
        },
      },
    };

    it('mặc định chạy thử (dry-run): chỉ SELECT, không ghi DB, không tạo tệp rollback', async () => {
      fs.writeFileSync(
        duongDanTepInput,
        JSON.stringify([
          {
            repo: 'astral-sh/uv',
            nhom: 'NGUON',
            lenh: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
            db: 'LINUX_MAC',
            moi: 'DUNG_CHUNG',
          },
        ]),
        'utf8',
      );

      const mockPrisma = {
        ungDung: {
          findMany: vi.fn().mockResolvedValue([mockAppDb]),
        },
        phanTichAI: {
          update: vi.fn(),
        },
        $transaction: vi.fn(),
      };

      const ketQua = await thucThiVaNhan(mockPrisma as any, {
        duongDanTep: duongDanTepInput,
        coGhi: false,
      });

      expect(mockPrisma.ungDung.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.phanTichAI.update).not.toHaveBeenCalled();
      expect(ketQua.soAppDaGhi).toBe(0);
      expect(ketQua.soCachCaiDaVa).toBe(1);
    });

    it('khi có cờ --ghi: lưu tệp rollback và gọi $transaction cập nhật CSDL', async () => {
      fs.writeFileSync(
        duongDanTepInput,
        JSON.stringify([
          {
            repo: 'astral-sh/uv',
            nhom: 'NGUON',
            lenh: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
            db: 'LINUX_MAC',
            moi: 'DUNG_CHUNG',
          },
        ]),
        'utf8',
      );

      const mockTx = {
        phanTichAI: {
          update: vi.fn().mockResolvedValue({}),
        },
      };

      const mockPrisma = {
        ungDung: {
          findMany: vi.fn().mockResolvedValue([mockAppDb]),
        },
        phanTichAI: {
          update: vi.fn(),
        },
        $transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
          return cb(mockTx);
        }),
      };

      const duongDanRollback = path.join(thuMucTam, 'test-rollback.json');
      const ketQua = await thucThiVaNhan(mockPrisma as any, {
        duongDanTep: duongDanTepInput,
        coGhi: true,
        duongDanRollbackTuyChon: duongDanRollback,
      });

      expect(mockPrisma.ungDung.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.phanTichAI.update).toHaveBeenCalledTimes(1);
      expect(ketQua.soAppDaGhi).toBe(1);
      expect(ketQua.soCachCaiDaVa).toBe(1);

      // Xác minh tệp rollback được tạo có nội dung chính xác
      expect(fs.existsSync(duongDanRollback)).toBe(true);
      const rollbackContent = JSON.parse(fs.readFileSync(duongDanRollback, 'utf8'));
      expect(rollbackContent).toEqual([
        {
          repo: 'astral-sh/uv',
          nhom: 'NGUON',
          lenh: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
          nhanCu: 'LINUX_MAC',
          nhanDaGhi: 'DUNG_CHUNG',
        },
      ]);
    });
  });
});
