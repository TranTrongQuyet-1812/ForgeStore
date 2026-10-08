/**
 * Tiện ích tạo và so khớp mẫu wildcard tên tệp cài đặt (P3B-17.1).
 * Giúp ghi nhớ biến thể đã chọn (chip x64/arm64, portable/setup, pro/lite...)
 * để lần cập nhật sau tự động chọn đúng loại tệp cũ mà không bắt người dùng chọn lại.
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tạo chuỗi mẫu wildcard từ tên tệp cài đặt và số phiên bản.
 * Thay thế số phiên bản (kèm tiền tố 'v' nếu có) bằng ký tự wildcard '*'.
 * Giữ nguyên các định danh biến thể khác (x64, arm64, portable, setup, pro, lite, universal...).
 *
 * @param tenTep Tên tệp cài đặt gốc (ví dụ: 'SuperApp-v1.2.3-x64-setup.exe', 'Rufus-4.4.exe')
 * @param phienBan Phiên bản tùy chọn (ví dụ: '1.2.3', 'v1.2.3')
 * @returns Chuỗi mẫu wildcard (ví dụ: 'SuperApp-*-x64-setup.exe', 'Rufus-*.exe')
 */
export function taoMauTenTepWildcard(tenTep: string, phienBan?: string): string {
  if (!tenTep) return '';
  const trimmedName = tenTep.trim();

  // 1. Nếu có phiên bản cụ thể, thử thay thế chính xác trong tên tệp
  if (phienBan && phienBan.trim()) {
    const cleanVer = phienBan.trim().replace(/^[vV]/, '');
    if (cleanVer.length > 0) {
      const verRegex = new RegExp(`[vV]?${escapeRegex(cleanVer)}`, 'i');
      if (verRegex.test(trimmedName)) {
        return trimmedName.replace(verRegex, '*');
      }
    }
  }

  // 2. Tự động nhận diện cụm phiên bản SemVer/CalVer bằng Regex:
  // Khớp: [vV]? số . số (. số)? (có thể có prerelease như -beta.1, -alpha, nhưng không ăn vào chip/biến thể như -x86, -x64, -arm64)
  const autoSemverRegex = /[vV]?\d+(?:\.\d+)+(?:[-_](?:alpha|beta|rc|preview|patch|dev)\.?\d*)?/i;
  if (autoSemverRegex.test(trimmedName)) {
    return trimmedName.replace(autoSemverRegex, '*');
  }

  // 3. Khớp phiên bản dạng số đơn lẻ kèm phân cách: ví dụ: 'app-4-x64.exe'
  const singleNumRegex = /[-_.][vV]?\d+[-_.]/i;
  if (singleNumRegex.test(trimmedName)) {
    return trimmedName.replace(singleNumRegex, '-*-');
  }

  return trimmedName;
}

/**
 * Kiểm tra xem một tên tệp có khớp với mẫu wildcard hay không.
 * Hỗ trợ ký tự '*' đại diện cho 0 hoặc nhiều ký tự bất kỳ.
 *
 * @param tenTep Tên tệp cần kiểm tra (ví dụ: 'SuperApp-v1.2.4-x64-setup.exe')
 * @param mauWildcard Mẫu wildcard đã lưu (ví dụ: 'SuperApp-*-x64-setup.exe')
 * @returns true nếu khớp biến thể
 */
export function khopMauTenTep(tenTep: string, mauWildcard: string): boolean {
  if (!tenTep || !mauWildcard) return false;
  const cleanName = tenTep.trim();
  const cleanPattern = mauWildcard.trim();

  if (cleanPattern === cleanName) return true;
  if (!cleanPattern.includes('*')) {
    return cleanName.toLowerCase() === cleanPattern.toLowerCase();
  }

  // Chuyển wildcard pattern thành Regex
  const parts = cleanPattern.split('*');
  const escapedParts = parts.map((part) => escapeRegex(part));
  const regexPattern = `^${escapedParts.join('.*?')}$`;

  try {
    const rx = new RegExp(regexPattern, 'i');
    return rx.test(cleanName);
  } catch {
    return false;
  }
}

/**
 * Tìm tệp cài đặt phù hợp nhất trong danh sách dựa trên mẫu biến thể đã lưu.
 *
 * @param danhSachTep Danh sách tệp cài đặt của release mới
 * @param mauWildcard Mẫu wildcard của biến thể người dùng đã cài trước đó
 * @returns Tệp cài đặt khớp với biến thể hoặc null nếu không tìm thấy
 */
export function timTepTheoMauWildcard<T extends { tenTep: string }>(
  danhSachTep: T[],
  mauWildcard?: string | null,
): T | null {
  if (!mauWildcard || !danhSachTep || danhSachTep.length === 0) return null;
  const found = danhSachTep.find((t) => khopMauTenTep(t.tenTep, mauWildcard));
  return found ?? null;
}
