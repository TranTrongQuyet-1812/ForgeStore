import { describe, it, expect } from 'vitest';
import { ApiError } from './api-client';
import { layThongBaoLoi } from './thong-bao-loi';

describe('layThongBaoLoi', () => {
  const macDinh = 'Lỗi kết nối khi kiểm tra repository.';

  it('lấy thongBao tiếng Việt mà backend trả kèm, không dùng chữ "API Error 400:" trống', () => {
    const err = new ApiError(400, '', {
      maLoi: 'DU_LIEU_KHONG_HOP_LE',
      thongBao: 'Bản phát hành của [videolan/vlc] không có tệp cài đặt phù hợp với WINDOWS.',
    });
    expect(layThongBaoLoi(err, macDinh)).toBe(
      'Bản phát hành của [videolan/vlc] không có tệp cài đặt phù hợp với WINDOWS.',
    );
  });

  it('429 kèm Retry-After thì hiện số phút phải chờ', () => {
    const err = new ApiError(429, '', { thongBao: 'ThrottlerException: Too Many Requests' }, 3284);
    expect(layThongBaoLoi(err, macDinh)).toBe(
      'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau khoảng 55 phút.',
    );
  });

  it('429 không đọc được Retry-After thì dùng câu chung, không hứa "vài giây"', () => {
    const err = new ApiError(429, '', { thongBao: 'ThrottlerException: Too Many Requests' });
    const msg = layThongBaoLoi(err, macDinh);
    expect(msg).toContain('quá nhiều lần');
    expect(msg).not.toContain('vài giây');
  });

  it('không có thongBao thì dùng câu mặc định', () => {
    expect(layThongBaoLoi(new ApiError(500, '', null), macDinh)).toBe(macDinh);
    expect(layThongBaoLoi(new ApiError(400, '', { thongBao: '  ' }), macDinh)).toBe(macDinh);
  });

  it('lỗi không phải ApiError (mất mạng...) dùng câu mặc định, không lộ chữ kỹ thuật', () => {
    expect(layThongBaoLoi(new TypeError('Failed to fetch'), macDinh)).toBe(macDinh);
    expect(layThongBaoLoi('boom', macDinh)).toBe(macDinh);
  });
});
