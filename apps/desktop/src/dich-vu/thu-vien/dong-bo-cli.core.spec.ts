import { describe, expect, it } from 'vitest';
import { giongPhienBan, quyetDinhDongBoCli } from './dong-bo-cli.core';

const choXacNhan = { trangThaiXacNhan: 'CHO_XAC_NHAN', phienBanHienTai: '1.0.0' };
const daXacNhan = { trangThaiXacNhan: 'DA_XAC_NHAN', phienBanHienTai: '1.0.0' };

describe('giongPhienBan', () => {
  it('bỏ qua chữ v đầu, hoa thường và khoảng trắng hai đầu', () => {
    expect(giongPhienBan('v1.2.3', '1.2.3')).toBe(true);
    expect(giongPhienBan('V1.2.3', ' 1.2.3 ')).toBe(true);
    expect(giongPhienBan('1.2.3-RC1', '1.2.3-rc1')).toBe(true);
    expect(giongPhienBan('1.2.3', '1.2.4')).toBe(false);
  });
});

describe('quyetDinhDongBoCli (P3B-30)', () => {
  it('tự xác nhận khi đang chờ xác nhận và gói có thật trên máy', () => {
    const qd = quyetDinhDongBoCli(choXacNhan, { daCai: true, phienBanThat: null });
    expect(qd.xacNhan).toBe(true);
  });

  it('không tự xác nhận khi không kiểm được hoặc gói chưa cài, và không tự xóa gì', () => {
    expect(quyetDinhDongBoCli(choXacNhan, { daCai: null, phienBanThat: null }).xacNhan).toBe(false);
    expect(quyetDinhDongBoCli(choXacNhan, { daCai: false, phienBanThat: null }).xacNhan).toBe(
      false,
    );
  });

  it('không xác nhận lại bản ghi đã xác nhận', () => {
    expect(quyetDinhDongBoCli(daXacNhan, { daCai: true, phienBanThat: null }).xacNhan).toBe(false);
  });

  it('ghi phiên bản thật khi khác số đang lưu (người dùng tự cập nhật ngoài ForgeStore)', () => {
    const qd = quyetDinhDongBoCli(daXacNhan, { daCai: true, phienBanThat: '2.0.0' });
    expect(qd.phienBanMoi).toBe('2.0.0');
  });

  it('thay số "latest" lúc bấm cài bằng phiên bản thật', () => {
    const qd = quyetDinhDongBoCli(
      { trangThaiXacNhan: 'DA_XAC_NHAN', phienBanHienTai: 'latest' },
      { daCai: null, phienBanThat: '3.1.0' },
    );
    expect(qd.phienBanMoi).toBe('3.1.0');
  });

  it('không ghi lại khi chỉ khác chữ v, và không ghi khi không đọc được phiên bản', () => {
    const luu = { trangThaiXacNhan: 'DA_XAC_NHAN', phienBanHienTai: 'v1.0.0' };
    expect(quyetDinhDongBoCli(luu, { daCai: true, phienBanThat: '1.0.0' }).phienBanMoi).toBeNull();
    expect(quyetDinhDongBoCli(luu, { daCai: true, phienBanThat: null }).phienBanMoi).toBeNull();
    expect(quyetDinhDongBoCli(luu, { daCai: true, phienBanThat: '' }).phienBanMoi).toBeNull();
  });

  it('vừa xác nhận vừa ghi phiên bản trong cùng một lần', () => {
    const qd = quyetDinhDongBoCli(choXacNhan, { daCai: true, phienBanThat: '1.5.0' });
    expect(qd).toEqual({ xacNhan: true, phienBanMoi: '1.5.0' });
  });
});
