import { describe, it, expect } from 'vitest';
import { JevBenchmarkService } from './jev-benchmark.service';

describe('JevBenchmarkService (P2-38)', () => {
  const service = new JevBenchmarkService();

  it('Benchmark chọn tệp: Phương pháp Lai đạt độ chính xác >= 95% (Nghiệm thu P2-38)', () => {
    const ketQua = service.chayBenchmarkChonFile();

    const chiLuat = ketQua.find((k) => k.phuongPhap === 'CHI_LUAT')!;
    const chiJev = ketQua.find((k) => k.phuongPhap === 'CHI_JEV')!;
    const lai = ketQua.find((k) => k.phuongPhap === 'LAI_LUAT_JEV')!;

    expect(chiLuat).toBeDefined();
    expect(chiJev).toBeDefined();
    expect(lai).toBeDefined();

    // Kiểm tra tỷ lệ chính xác cách lai >= 95%
    expect(lai.tyLeChinhXacPhanTram).toBeGreaterThanOrEqual(95);

    // Phương pháp lai phải chính xác hơn hoặc bằng chỉ luật
    expect(lai.tyLeChinhXacPhanTram).toBeGreaterThanOrEqual(chiLuat.tyLeChinhXacPhanTram);

    // Tỷ lệ gọi Jev của phương pháp lai phải thấp (chỉ gọi khi cần, tiết kiệm quota 5$/tháng D-10)
    expect(lai.tyLeGoiJevPhanTram).toBeLessThanOrEqual(30);

    // Độ trễ của phương pháp lai phải nhỏ hơn nhiều so với chỉ Jev
    expect(lai.doTreUocTinhMs).toBeLessThan(chiJev.doTreUocTinhMs);
  });

  it('Benchmark phán đoán quyền: Phương pháp Lai đạt độ chính xác cao và phát hiện 100% quyền nguy hiểm', () => {
    const ketQua = service.chayBenchmarkPhanDoanQuyen();

    const chiLuat = ketQua.find((k) => k.phuongPhap === 'CHI_LUAT')!;
    const lai = ketQua.find((k) => k.phuongPhap === 'LAI_LUAT_JEV')!;

    // Chỉ luật phạt oan cả ứng dụng hợp lý (false positives) nên độ chính xác thấp hơn
    expect(lai.tyLeChinhXacPhanTram).toBeGreaterThan(chiLuat.tyLeChinhXacPhanTram);
    expect(lai.tyLeChinhXacPhanTram).toBeGreaterThanOrEqual(90);

    // Phát hiện 100% quyền nguy hiểm
    expect(lai.soQuyenNguyHiemPhatHien).toBe(lai.tongQuyenNguyHiem);
  });

  it('Tạo báo cáo Markdown tổng kết đầy đủ bảng số liệu cho P7-04', () => {
    const baoCao = service.taoBaoCaoToanDien();

    expect(baoCao.baoCaoMarkdown).toContain('Báo Cáo Thực Nghiệm Benchmark Hệ Thống Dual-AI');
    expect(baoCao.baoCaoMarkdown).toContain('Phương Pháp');
    expect(baoCao.baoCaoMarkdown).toContain('Lai: Luật + Jev');
    expect(baoCao.baoCaoMarkdown).toContain('≥ 95% theo yêu cầu nghiệm thu P2-38');
  });
});
