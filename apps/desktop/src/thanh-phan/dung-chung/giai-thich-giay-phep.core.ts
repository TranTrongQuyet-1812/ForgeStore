import { rutGonGiayPhep } from './giay-phep.core';

export type NhomGiayPhep = 'RAT_THOANG' | 'MO_MA_THEO_PHAN' | 'BUOC_MO_MA' | 'CHUA_RO';

export interface GiaiThichGiayPhep {
  tenHienThi: string;
  nhom: NhomGiayPhep;
  nguoiDung: string;
  neuSuaHoacChiaSe: string;
  lienKetToanVan: string | null;
}

export const LUU_Y_GIAY_PHEP = 'Giải thích chỉ để tham khảo, không phải tư vấn pháp lý.';

const GOC_CHOOSEALICENSE = 'https://choosealicense.com/licenses';

// Dùng chung chuỗi mô tả quyền sử dụng để tránh lặp ở các giấy phép cùng điều kiện cơ bản.
const DUNG_MIEN_PHI_KINH_DOANH = 'Được dùng miễn phí, kể cả cho công việc kinh doanh.';
const DUNG_MIEN_PHI_CONG_VIEC = 'Được dùng miễn phí, kể cả cho công việc.';
const SUA_LGPL =
  'Dành cho thư viện: được dùng trong phần mềm khác mà không phải mở mã phần mềm đó (nếu chỉ liên kết, không sửa thư viện). Sửa chính thư viện rồi phát hành thì phần sửa phải mở theo LGPL. Phần mềm của bạn phải để người dùng thay được thư viện bằng bản sửa của họ.';

export const BANG_GIAI_THICH_GIAY_PHEP: Readonly<Record<string, GiaiThichGiayPhep>> = {
  MIT: {
    tenHienThi: 'Giấy phép MIT',
    nhom: 'RAT_THOANG',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe:
      'Được làm, chỉ cần giữ nguyên dòng ghi bản quyền và nội dung giấy phép. Tác giả không bảo hành.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/mit/`,
  },
  'Apache-2.0': {
    tenHienThi: 'Giấy phép Apache 2.0',
    nhom: 'RAT_THOANG',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe:
      'Được làm; phải giữ thông báo bản quyền và giấy phép, ghi rõ chỗ đã sửa. Tác giả cũng cho phép dùng các bằng sáng chế của họ nằm trong phần mềm này. Giấy phép không cấp quyền dùng tên hay nhãn hiệu của tác giả.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/apache-2.0/`,
  },
  'BSD-3-Clause': {
    tenHienThi: 'Giấy phép BSD 3 điều khoản',
    nhom: 'RAT_THOANG',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe:
      'Được làm, giữ thông báo bản quyền; không được dùng tên tác giả để quảng bá bản của bạn khi chưa được phép.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/bsd-3-clause/`,
  },
  'BSD-2-Clause': {
    tenHienThi: 'Giấy phép BSD 2 điều khoản',
    nhom: 'RAT_THOANG',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe: 'Được làm, chỉ cần giữ thông báo bản quyền.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/bsd-2-clause/`,
  },
  ISC: {
    tenHienThi: 'Giấy phép ISC',
    nhom: 'RAT_THOANG',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe: 'Được làm, chỉ cần giữ thông báo bản quyền.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/isc/`,
  },
  zlib: {
    tenHienThi: 'Giấy phép zlib',
    nhom: 'RAT_THOANG',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe:
      'Được làm; không được nói mình là người viết ra bản gốc, và bản đã sửa phải ghi rõ là đã sửa.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/zlib/`,
  },
  Unlicense: {
    tenHienThi: 'Giấy phép Unlicense',
    nhom: 'RAT_THOANG',
    nguoiDung: 'Được dùng miễn phí, tác giả đã đưa phần mềm vào phạm vi công cộng.',
    neuSuaHoacChiaSe: 'Được làm gần như tự do, không cần xin phép hay ghi công.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/unlicense/`,
  },
  CC0: {
    tenHienThi: 'Creative Commons Zero (CC0)',
    nhom: 'RAT_THOANG',
    nguoiDung:
      'Được dùng miễn phí, tác giả đã từ bỏ quyền tác giả trong phạm vi pháp luật cho phép.',
    neuSuaHoacChiaSe:
      'Được làm gần như tự do, không cần xin phép hay ghi công. Giấy phép này không cấp quyền về bằng sáng chế và nhãn hiệu.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/cc0-1.0/`,
  },
  'MPL-2.0': {
    tenHienThi: 'Giấy phép Mozilla 2.0 (MPL)',
    nhom: 'MO_MA_THEO_PHAN',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe:
      'Nếu sửa một tệp của dự án này rồi phát hành thì phải mở mã tệp đó; phần mã riêng bạn thêm vào có thể giữ kín.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/mpl-2.0/`,
  },
  'LGPL-3.0': {
    tenHienThi: 'Giấy phép LGPL (bản 3.0)',
    nhom: 'MO_MA_THEO_PHAN',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe: SUA_LGPL,
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/lgpl-3.0/`,
  },
  'LGPL-2.1': {
    tenHienThi: 'Giấy phép LGPL (bản 2.1)',
    nhom: 'MO_MA_THEO_PHAN',
    nguoiDung: DUNG_MIEN_PHI_KINH_DOANH,
    neuSuaHoacChiaSe: SUA_LGPL,
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/lgpl-2.1/`,
  },
  'GPL-3.0': {
    tenHienThi: 'Giấy phép GPL 3.0',
    nhom: 'BUOC_MO_MA',
    nguoiDung: DUNG_MIEN_PHI_CONG_VIEC,
    neuSuaHoacChiaSe:
      'Nếu bạn phát hành lại bản đã sửa, hoặc đưa mã này vào phần mềm khác rồi phát hành, thì phần mềm đó cũng phải mở mã theo GPL. Chỉ dùng riêng cho mình thì không bị buộc.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/gpl-3.0/`,
  },
  'GPL-2.0': {
    tenHienThi: 'Giấy phép GPL 2.0',
    nhom: 'BUOC_MO_MA',
    nguoiDung: DUNG_MIEN_PHI_CONG_VIEC,
    neuSuaHoacChiaSe:
      'Giống GPL 3.0 (là phiên bản cũ hơn): phát hành lại bản đã sửa hoặc phần mềm có chứa mã này thì phải mở mã theo GPL.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/gpl-2.0/`,
  },
  'AGPL-3.0': {
    tenHienThi: 'Giấy phép AGPL 3.0',
    nhom: 'BUOC_MO_MA',
    nguoiDung: DUNG_MIEN_PHI_CONG_VIEC,
    neuSuaHoacChiaSe:
      'Giống GPL 3.0 và chặt hơn: nếu bạn chạy bản đã sửa làm dịch vụ cho người khác dùng qua mạng thì cũng phải cung cấp mã nguồn cho họ.',
    lienKetToanVan: `${GOC_CHOOSEALICENSE}/agpl-3.0/`,
  },
};

// Các giấy phép `rutGonGiayPhep` chưa rút gọn nên tra chính xác theo tên GitHub và mã SPDX tại đây để không đổi logic cũ ở thẻ app.
const MA_GIAY_PHEP_BO_SUNG: Readonly<Record<string, string>> = {
  'isc license': 'ISC',
  isc: 'ISC',
  'zlib license': 'zlib',
  zlib: 'zlib',
  'creative commons zero v1.0 universal': 'CC0',
  'cc0-1.0': 'CC0',
};

function taoGiaiThichChuaRo(tenSach: string): GiaiThichGiayPhep {
  // Other và NOASSERTION đều là nhãn chưa phân loại của GitHub nên gộp chung tên hiển thị tiếng Việt đời thường.
  const laTenChung =
    !tenSach || tenSach.toLowerCase() === 'other' || tenSach.toUpperCase() === 'NOASSERTION';
  return {
    tenHienThi: laTenChung ? 'Giấy phép riêng hoặc chưa phân loại' : tenSach,
    nhom: 'CHUA_RO',
    nguoiDung:
      'Dự án này dùng giấy phép riêng, hoặc ForgeStore chưa có phần giải thích cho giấy phép này.',
    neuSuaHoacChiaSe:
      'Hãy đọc tệp giấy phép trên trang GitHub của dự án trước khi sửa, chia sẻ lại hay dùng cho mục đích đặc biệt.',
    lienKetToanVan: null,
  };
}

/** Tra giải thích dễ hiểu cho tên giấy phép GitHub hoặc mã SPDX; không bao giờ ném lỗi với dữ liệu lạ. */
export function giaiThichGiayPhep(tenGiayPhep: string | null | undefined): GiaiThichGiayPhep {
  const tenSach = typeof tenGiayPhep === 'string' ? tenGiayPhep.trim() : '';
  if (!tenSach) {
    return taoGiaiThichChuaRo('');
  }

  const maRutGon = rutGonGiayPhep(tenSach);
  if (Object.prototype.hasOwnProperty.call(BANG_GIAI_THICH_GIAY_PHEP, maRutGon)) {
    return BANG_GIAI_THICH_GIAY_PHEP[maRutGon];
  }

  const tenThuong = tenSach.toLowerCase();
  const maBoSung = Object.prototype.hasOwnProperty.call(MA_GIAY_PHEP_BO_SUNG, tenThuong)
    ? MA_GIAY_PHEP_BO_SUNG[tenThuong]
    : undefined;
  if (maBoSung && Object.prototype.hasOwnProperty.call(BANG_GIAI_THICH_GIAY_PHEP, maBoSung)) {
    return BANG_GIAI_THICH_GIAY_PHEP[maBoSung];
  }

  return taoGiaiThichChuaRo(tenSach);
}
