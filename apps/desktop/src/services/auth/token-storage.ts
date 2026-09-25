/**
 * Quản lý lưu trữ Token an toàn cho ForgeStore Desktop Client.
 *
 * Tuân thủ quy chuẩn bảo mật:
 * 1. Access Token: Chỉ lưu trữ thuần túy trong bộ nhớ RAM (Memory-Only), không bao giờ ghi xuống đĩa hoặc localStorage.
 * 2. Refresh Token:
 *    - Trong môi trường Native Tauri: Ghi trực tiếp vào Windows Credential Manager thông qua Rust Command (crate `keyring`).
 *    - Tuyệt đối KHÔNG lưu refresh token vào localStorage để chống đánh cắp qua XSS.
 *    - Môi trường Web Dev Preview: Lưu trữ fallback trong bộ nhớ (In-Memory) kèm cảnh báo debug.
 */

let inMemoryAccessToken: string | null = null;
let inMemoryDevRefreshToken: string | null = null;

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const tokenStorage = {
  /**
   * Lấy Access Token từ bộ nhớ RAM
   */
  getAccessToken(): string | null {
    return inMemoryAccessToken;
  },

  /**
   * Cập nhật Access Token trong bộ nhớ RAM
   */
  setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
  },

  /**
   * Đọc Refresh Token an toàn từ Windows Credential Manager (hoặc Dev Fallback)
   */
  async getRefreshToken(): Promise<string | null> {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const token = await invoke<string | null>('lay_refresh_token');
        return token;
      } catch (err) {
        console.error(
          '[TokenStorage] Lỗi khi đọc Refresh Token từ Windows Credential Manager:',
          err,
        );
        return null;
      }
    }
    return inMemoryDevRefreshToken;
  },

  /**
   * Lưu trữ Refresh Token an toàn vào Windows Credential Manager (hoặc Dev Fallback)
   */
  async setRefreshToken(token: string): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('luu_refresh_token', { token });
        return;
      } catch (err) {
        console.error(
          '[TokenStorage] Lỗi khi lưu Refresh Token vào Windows Credential Manager:',
          err,
        );
        throw err;
      }
    }
    inMemoryDevRefreshToken = token;
  },

  /**
   * Xóa Refresh Token trong Windows Credential Manager khi Đăng xuất
   */
  async clearRefreshToken(): Promise<void> {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('xoa_refresh_token');
      } catch (err) {
        console.error(
          '[TokenStorage] Lỗi khi xóa Refresh Token trong Windows Credential Manager:',
          err,
        );
      }
    }
    inMemoryDevRefreshToken = null;
  },

  /**
   * Xóa toàn bộ token khỏi hệ thống
   */
  async clearAllTokens(): Promise<void> {
    this.setAccessToken(null);
    await this.clearRefreshToken();
  },
};
