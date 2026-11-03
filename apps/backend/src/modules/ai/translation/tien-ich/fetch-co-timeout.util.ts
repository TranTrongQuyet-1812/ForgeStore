/** Giới hạn thời gian gọi nhà dịch tìm kiếm để lỗi mạng không chặn các nhà dự phòng. */
export async function goiFetchCoTimeout<T>(
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  docPhanHoi: (response: Response) => Promise<T>,
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return await docPhanHoi(response);
  } finally {
    clearTimeout(timeout);
  }
}
