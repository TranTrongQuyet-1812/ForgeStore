const MAY_CHU_ANH_GITHUB = 'avatars.githubusercontent.com';

/**
 * Ảnh đại diện GitHub mặc định rộng 460px, trong khi icon thẻ chỉ hiện 48px.
 * Xin sẵn bản nhỏ (thường gấp đôi kích thước hiển thị cho màn hình nét cao) để giải mã nhẹ hơn nhiều,
 * nhất là khi cuộn qua hàng trăm thẻ. Địa chỉ ảnh khác hoặc không đọc được thì giữ nguyên.
 */
export function thuNhoAnhDaiDien(duongDan: string, canhPx: number): string {
  try {
    const url = new URL(duongDan);
    if (url.hostname !== MAY_CHU_ANH_GITHUB || url.searchParams.has('s')) return duongDan;

    url.searchParams.set('s', String(canhPx));
    return url.toString();
  } catch {
    return duongDan;
  }
}
