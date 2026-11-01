function chuanHoaGiayPhep(value: string): string {
  // Chuẩn hóa cách viết trước khi dò để các tên giấy phép tương đương dùng chung mã ngắn.
  return value.toLocaleUpperCase('en').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function coPhienBan(value: string, phienBan: string): boolean {
  return new RegExp(`(?:^|[\\s-]|V)${phienBan.replace('.', '\\.')}\\b`).test(value);
}

export function rutGonGiayPhep(tenGiayPhep: string): string {
  const ten = chuanHoaGiayPhep(tenGiayPhep);
  if (/GNU AFFERO|\bAGPL\b/.test(ten)) {
    return coPhienBan(ten, '3.0') || /AGPL ?3/.test(ten) ? 'AGPL-3.0' : 'AGPL';
  }
  if (/GNU LESSER|\bLGPL\b|LESSER GENERAL PUBLIC/.test(ten)) {
    if (coPhienBan(ten, '3.0') || /LGPL ?3/.test(ten)) return 'LGPL-3.0';
    if (coPhienBan(ten, '2.1') || /LGPL ?2\.1/.test(ten)) return 'LGPL-2.1';
    if (coPhienBan(ten, '2.0') || /LGPL ?2/.test(ten)) return 'LGPL-2.0';
    return 'LGPL';
  }
  if (/GNU GENERAL PUBLIC|\bGPL\b/.test(ten)) {
    if (coPhienBan(ten, '3.0') || /GPL ?3/.test(ten)) return 'GPL-3.0';
    if (coPhienBan(ten, '2.0') || /GPL ?2/.test(ten)) return 'GPL-2.0';
  }
  if (/APACHE.*2(?:\.0)?|APACHE-2(?:\.0)?/.test(ten)) return 'Apache-2.0';
  if (/THE UNLICENSE|^UNLICENSE$/.test(ten)) return 'Unlicense';
  if (/^MIT(?: LICENSE)?$/.test(ten)) return 'MIT';
  if (/BSD/.test(ten)) {
    if (/2[- ]CLAUSE|SIMPLIFIED/.test(ten)) return 'BSD-2-Clause';
    if (/3[- ]CLAUSE|NEW.*REVISED|REVISED.*NEW/.test(ten)) return 'BSD-3-Clause';
  }
  if (/MOZILLA|\bMPL\b/.test(ten) && /2(?:\.0)?/.test(ten)) return 'MPL-2.0';
  // Giữ nguyên tên chưa nhận diện để người dùng vẫn xem được đầy đủ qua tooltip.
  return tenGiayPhep.trim();
}
