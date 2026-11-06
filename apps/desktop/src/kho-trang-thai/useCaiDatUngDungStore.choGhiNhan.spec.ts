import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCaiDatUngDungStore } from './useCaiDatUngDungStore';
import { thuVienService } from '../dich-vu/thu-vien/thu-vien.service';

describe('Hàng chờ ghi Thư viện (cài xong nhưng lưu lên máy chủ lỗi)', () => {
  const dto = { maUngDung: 'app-1', phienBanHienTai: '1.0.0' };

  beforeEach(() => {
    useCaiDatUngDungStore.setState({
      choGhiNhan: { 'app-1': { maThietBi: 'tb-1', dto } },
    });
  });

  it('máy chủ vẫn lỗi thì giữ lại để thử lần sau', async () => {
    const spy = vi
      .spyOn(thuVienService, 'ghiNhanCaiDatCoKetQua')
      .mockResolvedValue({ thanhCong: false, thuLaiDuoc: true });
    await useCaiDatUngDungStore.getState().thuGhiNhanLai();
    expect(spy).toHaveBeenCalledWith('tb-1', dto);
    expect(useCaiDatUngDungStore.getState().choGhiNhan['app-1']).toBeDefined();
    spy.mockRestore();
  });

  it('ghi được thì bỏ khỏi hàng chờ', async () => {
    const spy = vi
      .spyOn(thuVienService, 'ghiNhanCaiDatCoKetQua')
      .mockResolvedValue({ thanhCong: true, thuLaiDuoc: false });
    await useCaiDatUngDungStore.getState().thuGhiNhanLai();
    expect(useCaiDatUngDungStore.getState().choGhiNhan).toEqual({});
    spy.mockRestore();
  });

  it('lỗi vĩnh viễn (4xx) thì bỏ khỏi hàng chờ, không thử lại mãi', async () => {
    const spy = vi
      .spyOn(thuVienService, 'ghiNhanCaiDatCoKetQua')
      .mockResolvedValue({ thanhCong: false, thuLaiDuoc: false });
    await useCaiDatUngDungStore.getState().thuGhiNhanLai();
    expect(useCaiDatUngDungStore.getState().choGhiNhan).toEqual({});
    spy.mockRestore();
  });

  it('đăng xuất thì bỏ hàng chờ của người cũ', () => {
    useCaiDatUngDungStore.getState().xoaTrangThaiTam();
    expect(useCaiDatUngDungStore.getState().choGhiNhan).toEqual({});
  });
});
