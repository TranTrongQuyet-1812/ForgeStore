import { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { headerBaoMat } from './header-bao-mat.middleware';

describe('headerBaoMat', () => {
  it('gắn nosniff và HSTS rồi cho request đi tiếp', () => {
    const setHeader = vi.fn();
    const next = vi.fn();

    headerBaoMat({} as Request, { setHeader } as unknown as Response, next);

    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=15552000');
    expect(next).toHaveBeenCalledOnce();
  });
});
