import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  function createMockHost(url = '/api/v1/test', requestId = 'req-test-123') {
    const mockJson = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    const mockResponse = { status: mockStatus };
    const mockRequest = {
      method: 'GET',
      url,
      headers: { 'x-request-id': requestId },
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;

    return { host, mockStatus, mockJson };
  }

  it('chuẩn hóa mã lỗi 404 thành KHONG_TIM_THAY_DU_LIEU (không dùng tiếng Anh Not Found)', () => {
    const { host, mockStatus, mockJson } = createMockHost('/api/v1/khong-ton-tai');
    const notFoundEx = new NotFoundException('Cannot GET /api/v1/khong-ton-tai');

    filter.catch(notFoundEx, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        maLoi: 'KHONG_TIM_THAY_DU_LIEU',
        duongDan: '/api/v1/khong-ton-tai',
      }),
    );
  });

  it('chuẩn hóa mã lỗi 400 từ ValidationPipe thành DU_LIEU_KHONG_HOP_LE và chi tiết lỗi', () => {
    const { host, mockStatus, mockJson } = createMockHost('/api/v1/apps');
    const badRequestEx = new BadRequestException({
      message: ['tenRepoDayDu không được để trống'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(badRequestEx, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        maLoi: 'DU_LIEU_KHONG_HOP_LE',
        chiTiet: ['tenRepoDayDu không được để trống'],
      }),
    );
  });

  it('giữ nguyên mã lỗi tùy chỉnh nếu exception chủ động định nghĩa maLoi', () => {
    const { host, mockStatus, mockJson } = createMockHost('/api/v1/auth');
    const customEx = new BadRequestException({
      maLoi: 'MA_XAC_THUC_HET_HAN',
      thongBao: 'Mã xác thực đã hết hạn, vui lòng đăng nhập lại',
    });

    filter.catch(customEx, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        maLoi: 'MA_XAC_THUC_HET_HAN',
        thongBao: 'Mã xác thực đã hết hạn, vui lòng đăng nhập lại',
      }),
    );
  });

  it('chuẩn hóa lỗi chưa bắt 500 thành LOI_HE_THONG', () => {
    const { host, mockStatus, mockJson } = createMockHost('/api/v1/crash');
    const unexpectedError = new Error('Database connection failed');

    filter.catch(unexpectedError, host);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        maLoi: 'LOI_HE_THONG',
        thongBao: 'Đã có lỗi hệ thống xảy ra, vui lòng thử lại sau',
      }),
    );
  });
});
