import { describe, it, expect } from 'vitest';
import { tinhTrangThaiHieuLuc, bienTheKhopTab } from './DetailPage';

describe('tinhTrangThaiHieuLuc - Trạng thái nút cài đặt theo từng định dạng (A2 & A3)', () => {
  describe('Tab EXE / MSI (Hệ thống)', () => {
    it('hiển thị DA_CAI_DAT khi server xác nhận máy này đã cài đặt ứng dụng (A3)', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'EXE',
        isInstalledOnDevice: true,
        localStatus: 'CHUA_CAI',
      });
      expect(status).toBe('DA_CAI_DAT');
    });

    it('hiển thị DA_CAI_DAT khi vừa cài đặt xong trong phiên làm việc hiện tại', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'MSI',
        isInstalledOnDevice: false,
        localStatus: 'DA_CAI_DAT',
      });
      expect(status).toBe('DA_CAI_DAT');
    });

    it('EC-01: Tab EXE/MSI KHÔNG nhận DA_CAI_DAT khi vừa tải hoặc giải nén bản ZIP', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'EXE',
        isInstalledOnDevice: false,
        localStatus: 'DA_CAI_DAT',
        installedFileType: 'ZIP_PORTABLE',
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('hiển thị CHUA_CAI khi máy tính này chưa cài đặt ứng dụng (dù tài khoản đã cài trên máy khác)', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'EXE',
        isInstalledOnDevice: false,
        localStatus: 'CHUA_CAI',
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('hiển thị tiến trình DANG_TAI khi đang tải bộ cài EXE', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'EXE',
        isInstalledOnDevice: false,
        localStatus: 'DANG_TAI',
      });
      expect(status).toBe('DANG_TAI');
    });

    it('FE-EC-02: Tab EXE/MSI ưu tiên hiển thị tiến trình DANG_TAI / XAC_MINH / DANG_CAI_DAT khi isInstalledOnDevice = true (khi cập nhật bản mới)', () => {
      // Ứng dụng đã cài trên máy (isInstalledOnDevice = true), nhưng người dùng đang bấm Cập Nhật
      // Nút PHẢI hiển thị tiến trình tải/xác minh/cài thay vì bị kẹt ở nhãn "ĐÃ CÀI ĐẶT"!
      expect(
        tinhTrangThaiHieuLuc({
          selectedFormat: 'EXE',
          isInstalledOnDevice: true,
          localStatus: 'DANG_TAI',
        }),
      ).toBe('DANG_TAI');

      expect(
        tinhTrangThaiHieuLuc({
          selectedFormat: 'MSI',
          isInstalledOnDevice: true,
          localStatus: 'XAC_MINH',
        }),
      ).toBe('XAC_MINH');

      expect(
        tinhTrangThaiHieuLuc({
          selectedFormat: 'EXE',
          isInstalledOnDevice: true,
          localStatus: 'DANG_CAI_DAT',
        }),
      ).toBe('DANG_CAI_DAT');
    });
  });

  describe('Tab ZIP / Portable (A2)', () => {
    it('LUÔN CHO PHÉP TẢI (CHUA_CAI) ngay cả khi máy đã cài đặt bản EXE/MSI (A2)', () => {
      // Bản EXE đã cài trên máy này (isInstalledOnDevice = true)
      // Người dùng chuyển sang tab ZIP: Nút PHẢI ở trạng thái sẵn sàng tải!
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: true,
        localStatus: 'CHUA_CAI',
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('hoạt động tương tự với định dạng ZIP_PORTABLE', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP_PORTABLE',
        isInstalledOnDevice: true,
        localStatus: 'CHUA_CAI',
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('hiển thị DANG_TAI khi đang tải bản ZIP portable', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: true,
        localStatus: 'DANG_TAI',
      });
      expect(status).toBe('DANG_TAI');
    });

    it('hiển thị DANG_CAI_DAT (giải nén) khi đang giải nén bản ZIP', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: false,
        localStatus: 'DANG_CAI_DAT',
      });
      expect(status).toBe('DANG_CAI_DAT');
    });

    it('L-08: Tab ZIP trở về CHUA_CAI khi vừa giải nén xong bản ZIP trong phiên này (luôn cho phép tải/giải nén lại)', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: false,
        localStatus: 'DA_CAI_DAT',
        installedFileType: 'ZIP',
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('FE-01: KHÔNG hiển thị DA_CAI_DAT ở tab ZIP khi ứng dụng vừa cài xong bản EXE (không có thư mục ZIP)', () => {
      // Người dùng vừa cài xong bản EXE (localStatus = 'DA_CAI_DAT', loaiTep = 'EXE')
      // Khi chuyển sang tab ZIP, nút vẫn phải là CHUA_CAI để cho phép tải portable!
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: true,
        localStatus: 'DA_CAI_DAT',
        installedFileType: 'EXE',
        hasExtractedDir: false,
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('L-08: Tab ZIP trở về CHUA_CAI kể cả khi có thư mục giải nén portable hợp lệ (không kẹt nút Đã Cài Đặt)', () => {
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: true,
        localStatus: 'DA_CAI_DAT',
        installedFileType: 'ZIP_PORTABLE',
        hasExtractedDir: true,
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('FE-V3-03: phân lập Task Slot - Tab ZIP KHÔNG hiển thị tiến trình tải khi đang tải bộ cài EXE', () => {
      // Ứng dụng đang trong tiến trình tải file EXE (localStatus = 'DANG_TAI', installedFileType = 'EXE')
      // Chuyển sang Tab ZIP: nút của Tab ZIP PHẢI ở trạng thái CHUA_CAI độc lập!
      const status = tinhTrangThaiHieuLuc({
        selectedFormat: 'ZIP',
        isInstalledOnDevice: false,
        localStatus: 'DANG_TAI',
        installedFileType: 'EXE',
      });
      expect(status).toBe('CHUA_CAI');
    });

    it('FE-V3-03: phân lập Task Slot - Tab EXE KHÔNG hiển thị tiến trình tải khi đang tải bản ZIP Portable', () => {
      // Ứng dụng đang trong tiến trình tải file ZIP (localStatus = 'DANG_TAI', installedFileType = 'ZIP')
      // Tab EXE: nếu máy chưa cài đặt thì hiển thị CHUA_CAI, không bị kẹt thanh tải của ZIP
      const statusChuaCai = tinhTrangThaiHieuLuc({
        selectedFormat: 'EXE',
        isInstalledOnDevice: false,
        localStatus: 'DANG_TAI',
        installedFileType: 'ZIP_PORTABLE',
      });
      expect(statusChuaCai).toBe('CHUA_CAI');

      // Nếu máy đã cài bản EXE trước đó, Tab EXE giữ nguyên DA_CAI_DAT
      const statusDaCai = tinhTrangThaiHieuLuc({
        selectedFormat: 'EXE',
        isInstalledOnDevice: true,
        localStatus: 'DANG_TAI',
        installedFileType: 'ZIP_PORTABLE',
      });
      expect(statusDaCai).toBe('DA_CAI_DAT');
    });
  });
});

describe('bienTheKhopTab - Biến thể đã nhớ chỉ áp dụng đúng tab (P3B-17.1)', () => {
  const bien7z = { maTep: 'a', dinhDangTep: 'ZIP_PORTABLE' };

  it('trả về biến thể khi cùng loại với tab đang mở', () => {
    expect(bienTheKhopTab(bien7z, 'ZIP_PORTABLE')).toBe(bien7z);
  });

  it('bỏ biến thể .7z đã nhớ khi tab đang mở là EXE, để bấm tab EXE chọn được tệp EXE', () => {
    expect(bienTheKhopTab(bien7z, 'EXE')).toBeNull();
  });

  it('không phân biệt hoa thường và coi thiếu định dạng là EXE', () => {
    expect(bienTheKhopTab(bien7z, 'zip_portable')).toBe(bien7z);
    const khongDinhDang: { maTep: string; dinhDangTep?: string } = { maTep: 'b' };
    expect(bienTheKhopTab(khongDinhDang, 'EXE')).toBe(khongDinhDang);
  });

  it('không có biến thể đã nhớ thì trả về null', () => {
    expect(bienTheKhopTab(null, 'EXE')).toBeNull();
    expect(bienTheKhopTab(undefined, 'EXE')).toBeNull();
  });
});
