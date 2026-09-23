import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface StandardErrorResponse {
  maLoi: string;
  thongBao: string;
  chiTiet?: unknown;
  duongDan: string;
  thoiGian: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';
    const requestId = (request.headers['x-request-id'] as string) || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let maLoi = 'LOI_HE_THONG';
    let thongBao = 'Đã có lỗi hệ thống xảy ra, vui lòng thử lại sau';
    let chiTiet: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        thongBao = res;
        maLoi = this.mapStatusToErrorCode(status);
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        thongBao = (resObj.message as string) || exception.message;
        maLoi = (resObj.error as string) || this.mapStatusToErrorCode(status);
        chiTiet = resObj.message instanceof Array ? resObj.message : resObj.details || undefined;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[${requestId}] Lỗi chưa bắt: ${exception.message}`,
        isProduction ? undefined : exception.stack,
      );
      if (!isProduction) {
        chiTiet = exception.message;
      }
    }

    const errorPayload: StandardErrorResponse = {
      maLoi,
      thongBao: Array.isArray(thongBao) ? thongBao.join('; ') : thongBao,
      ...(chiTiet ? { chiTiet } : {}),
      duongDan: request.url,
      thoiGian: new Date().toISOString(),
    };

    response.status(status).json(errorPayload);
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'DU_LIEU_KHONG_HOP_LE';
      case HttpStatus.UNAUTHORIZED:
        return 'CHUA_XAC_THUC';
      case HttpStatus.FORBIDDEN:
        return 'KHONG_CO_QUYEN_TRUY_CAP';
      case HttpStatus.NOT_FOUND:
        return 'KHONG_TIM_THAY_DU_LIEU';
      case HttpStatus.CONFLICT:
        return 'XUNG_DOT_DU_LIEU';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'VUOT_QUA_HAN_NGACH_TRUY_CAP';
      default:
        return 'LOI_MAY_CHU';
    }
  }
}
