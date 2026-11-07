import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CapNhatPhienBanCliDto } from './ung-dung-da-cai.dto';

async function hopLe(phienBan: unknown): Promise<boolean> {
  const dto = plainToInstance(CapNhatPhienBanCliDto, { phienBan });
  return (await validate(dto)).length === 0;
}

describe('CapNhatPhienBanCliDto (P3B-30)', () => {
  it('nhận các dạng phiên bản thông dụng của npm và pip', async () => {
    for (const v of [
      '1.2.3',
      '0.0.1',
      '2.0.0-beta.1',
      '1.4.2+build.5',
      '24.1',
      '1.0.0rc1',
      'v1.2.3',
    ]) {
      expect(await hopLe(v), v).toBe(true);
    }
  });

  it('từ chối chuỗi rỗng, có khoảng trắng, ký tự điều khiển hay ký tự nguy hiểm', async () => {
    for (const v of ['', ' ', '1.2 3', '1.2.3\n', '1.2.3; rm -rf /', '<script>', '../x', '-1.0']) {
      expect(await hopLe(v), JSON.stringify(v)).toBe(false);
    }
  });

  it('từ chối chuỗi dài hơn 100 ký tự và giá trị không phải chuỗi', async () => {
    expect(await hopLe('1'.repeat(101))).toBe(false);
    expect(await hopLe(123)).toBe(false);
    expect(await hopLe(undefined)).toBe(false);
  });
});
