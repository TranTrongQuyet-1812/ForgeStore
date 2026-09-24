/**
 * Tiện ích so sánh phiên bản phần mềm (SemVer, CalVer, GitHub Tags) thuần khiết không side-effect (P2-52.2).
 */

/**
 * Chuẩn hóa chuỗi phiên bản:
 * - Cắt khoảng trắng
 * - Loại bỏ tiền tố 'v' hoặc 'V' (ví dụ: 'v1.2.3' -> '1.2.3')
 * - Bỏ metadata build sau dấu '+' (ví dụ: '1.2.3+2024' -> '1.2.3')
 */
export function chuanHoaPhienBan(v: string): string {
  if (!v) return '';
  const firstPart = v.trim().replace(/^[vV]/, '').split('+')[0];
  return (firstPart ?? '').trim();
}

/**
 * So sánh 2 phiên bản a (hiện tại) và b (mục tiêu/mới).
 * @returns
 *   1 nếu b MỚI HƠN a (cần cập nhật)
 *  -1 nếu b CŨ HƠN a
 *   0 nếu a và b TƯƠNG ĐƯƠNG nhau
 */
export function soSanhPhienBan(a: string, b: string): number {
  const cleanA = chuanHoaPhienBan(a);
  const cleanB = chuanHoaPhienBan(b);

  if (cleanA === cleanB) {
    return 0;
  }

  // Tách phần phiên bản chính và phần tiền phát hành (prerelease, ví dụ: '1.0.0-beta.1')
  const partsA = cleanA.split('-');
  const mainA = partsA[0] ?? '';
  const preA = partsA.slice(1).join('-');

  const partsB = cleanB.split('-');
  const mainB = partsB[0] ?? '';
  const preB = partsB.slice(1).join('-');

  // Tách các đoạn số/chữ của phần main (hỗ trợ cả dấu chấm '.' và gạch dưới '_')
  const segsA = mainA.split(/[._]/);
  const segsB = mainB.split(/[._]/);

  const maxLen = Math.max(segsA.length, segsB.length);

  for (let i = 0; i < maxLen; i++) {
    const rawPartA = segsA[i] ?? '0';
    const rawPartB = segsB[i] ?? '0';

    const numA = Number(rawPartA);
    const numB = Number(rawPartB);

    const isNumA = !isNaN(numA) && rawPartA.trim() !== '';
    const isNumB = !isNaN(numB) && rawPartB.trim() !== '';

    if (isNumA && isNumB) {
      if (numB > numA) return 1;
      if (numB < numA) return -1;
    } else {
      // So sánh theo thứ tự từ điển nếu có ký tự chữ
      const cmp = rawPartB.localeCompare(rawPartA, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (cmp !== 0) {
        return cmp > 0 ? 1 : -1;
      }
    }
  }

  // Nếu phần main hoàn toàn bằng nhau, xét đến prerelease
  // Quy tắc SemVer: Bản phát hành chính thức (không có prerelease) MỚI HƠN bản prerelease
  // Ví dụ: '1.0.0' mới hơn '1.0.0-beta'
  if (preA && !preB) {
    // b là bản chính thức, a là bản prerelease -> b mới hơn a
    return 1;
  }
  if (!preA && preB) {
    // a là bản chính thức, b là bản prerelease -> b cũ hơn a
    return -1;
  }

  if (preA && preB) {
    // Cả 2 đều là prerelease -> so sánh cấp độ prerelease
    const levelOrder: Record<string, number> = {
      alpha: 1,
      a: 1,
      beta: 2,
      b: 2,
      rc: 3,
      preview: 3,
    };

    const extractLevel = (p: string) => {
      const match = p.toLowerCase().match(/^(alpha|beta|rc|preview|[a-z]+)/);
      const tag = match && match[1] ? match[1] : '';
      return tag && tag in levelOrder ? levelOrder[tag]! : 0;
    };

    const lvlA = extractLevel(preA);
    const lvlB = extractLevel(preB);

    if (lvlB > lvlA) return 1;
    if (lvlB < lvlA) return -1;

    // Cùng level -> so sánh từ điển số tự nhiên
    const cmp = preB.localeCompare(preA, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) {
      return cmp > 0 ? 1 : -1;
    }
  }

  return 0;
}

/**
 * Kiểm tra xem phiên bản mới (b) có thực sự mới hơn phiên bản hiện tại (a) hay không.
 */
export function coBanMoiHon(phienBanHienTai: string, phienBanMoi: string): boolean {
  return soSanhPhienBan(phienBanHienTai, phienBanMoi) > 0;
}
