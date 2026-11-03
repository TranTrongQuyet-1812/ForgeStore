import { afterEach, describe, expect, it, vi } from 'vitest';
import { goiFetchCoTimeout } from './fetch-co-timeout.util';

describe('goiFetchCoTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hủy lời gọi bị treo để service có thể thử nhà dịch tiếp theo', async () => {
    vi.useFakeTimers();
    const fetchGia = vi.fn(
      (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    vi.stubGlobal('fetch', fetchGia);

    const ketQua = expect(
      goiFetchCoTimeout('https://example.test', {}, async (response) => response, 10_000),
    ).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(10_000);

    await ketQua;
    expect(fetchGia.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('giữ timeout cho cả lúc đọc thân phản hồi sau khi đã nhận header', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchGia = vi.fn((_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return Promise.resolve({ ok: true } as Response);
    });
    vi.stubGlobal('fetch', fetchGia);
    const ketQua = expect(
      goiFetchCoTimeout(
        'https://example.test',
        {},
        async () =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new Error('aborted body')));
          }),
        10_000,
      ),
    ).rejects.toThrow('aborted body');

    await vi.advanceTimersByTimeAsync(10_000);
    await ketQua;
  });
});
