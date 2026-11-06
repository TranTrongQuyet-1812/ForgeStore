// Chẩn đoán chỉ-đọc: ráp lại README từ 04_loi (giống nhap) rồi in phần khác nhau của từng bất biến bị báo.
import * as fs from 'fs';
import {
  phanTichReadme,
  rapLaiReadme,
  kiemBatBienReadme,
} from '../src/modules/ai/translation/tien-ich/readme-markdown-processor.util';

const GOC = 'E:/Du_An_Ca_Nhan/BaocaoForgeStore/Dich_Hang_Loat_V2';
const ca: Array<[string, string, string]> = [
  ['Anti', 'dich2-l025', 'konvajs/konva'],
  ['Anti', 'dich2-l031', 'pressly/goose'],
  ['Anti', 'dich2-l068', 'Baekalfen/PyBoy'],
  ['DeepSeek', 'dich2-l207', 'akosbalasko/yarle'],
  ['DeepSeek', 'dich2-l284', 'securisec/chepy'],
  ['CommandCode', 'dich2-l292', 'kividbio/kividb'],
];
const doc = (p: string) =>
  fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const khac = (a: string[], b: string[]) => {
  const ca = [...a].sort();
  const cb = [...b].sort();
  return {
    chiGoc: ca.filter((x) => !cb.includes(x)).slice(0, 4),
    chiDich: cb.filter((x) => !ca.includes(x)).slice(0, 4),
  };
};
const khoiCode = (md: string) => md.match(/^\s{0,3}(`{3,}|~{3,})[\s\S]*?^\s{0,3}\1\s*$/gm) ?? [];
const inline = (md: string) => md.match(/`+[^`\n]+`+/g) ?? [];
const url = (md: string) => md.match(/(?:https?:\/\/|mailto:)[^\s<>)\]`]+/g) ?? [];
const muc = (md: string) => md.match(/^\s{0,3}(?:[-+*]|\d+[.)])\s+.*$/gm) ?? [];

for (const [ai, lo, repo] of ca) {
  const cao = doc(`${GOC}/${ai}/01_da_cao/${lo}.jsonl`).find((r) => r.repo === repo);
  const loi = doc(`${GOC}/${ai}/04_loi/${lo}.jsonl`).find((r) => r.repo === repo);
  if (!cao || !loi) {
    console.log(repo, 'thiếu dữ liệu', !!cao, !!loi);
    continue;
  }
  const goc: string = cao.readmeEn;
  const cauTruc = phanTichReadme(goc);
  const map = new Map<number, string>(loi.doan.map((d: { stt: number; vi: string }) => [d.stt, d.vi]));
  const dich = rapLaiReadme(goc, cauTruc, map);
  const kq = kiemBatBienReadme(goc, dich).canhBao.filter((c) => /thay_doi/.test(c));
  console.log(`\n### ${repo}: ${kq.join(', ')}`);
  if (kq.includes('khoi_code_thay_doi')) {
    const k = khac(khoiCode(goc), khoiCode(dich));
    console.log(' khối code: số', khoiCode(goc).length, '->', khoiCode(dich).length);
    console.log(' chỉ ở gốc:', JSON.stringify(k.chiGoc.map((x) => x.slice(0, 160))));
    console.log(' chỉ ở dịch:', JSON.stringify(k.chiDich.map((x) => x.slice(0, 160))));
  }
  if (kq.includes('ma_inline_thay_doi')) console.log(' inline:', JSON.stringify(khac(inline(goc), inline(dich))));
  if (kq.includes('url_thay_doi')) console.log(' url:', JSON.stringify(khac(url(goc), url(dich))));
  if (kq.includes('so_muc_danh_sach_thay_doi')) {
    console.log(' mục ds:', muc(goc).length, '->', muc(dich).length);
    console.log(' ', JSON.stringify(khac(muc(goc), muc(dich))));
  }
}

// Thử bộ kiểm đã sửa: ghép backtick đúng độ dài như bộ tách, bỏ comment HTML trước khi tìm khối code
const inlineMoi = (md: string) =>
  md.replace(/<!--[\s\S]*?-->/g, '').match(/(?<![\`])(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g) ?? [];
const khongChuThich = (md: string) => md.replace(/<!--[\s\S]*?-->/g, '');
console.log('\n==== THỬ BỘ KIỂM MỚI ====');
for (const [ai, lo, repo] of ca) {
  const cao = doc(`${GOC}/${ai}/01_da_cao/${lo}.jsonl`).find((r) => r.repo === repo);
  const loi = doc(`${GOC}/${ai}/04_loi/${lo}.jsonl`).find((r) => r.repo === repo);
  const goc: string = cao.readmeEn;
  const map = new Map<number, string>(loi.doan.map((d: { stt: number; vi: string }) => [d.stt, d.vi]));
  const dich = rapLaiReadme(goc, phanTichReadme(goc), map);
  const kq = kiemBatBienReadme(khongChuThich(goc), khongChuThich(dich)).canhBao.filter((c) => /thay_doi/.test(c) && c !== 'ma_inline_thay_doi');
  const inl = JSON.stringify(inlineMoi(goc).sort()) === JSON.stringify(inlineMoi(dich).sort());
  console.log(repo, '| bất biến còn lại:', kq.join(',') || 'không', '| inline khớp:', inl);
  if (kq.includes('so_muc_danh_sach_thay_doi')) {
    const g = muc(goc), d = muc(dich);
    console.log('   mục:', g.length, d.length);
  }
}

console.log('\n==== SOI CHI TIẾT ====');
for (const [ai, lo, repo] of ca.filter(([, , r]) => ['pressly/goose', 'akosbalasko/yarle', 'kividbio/kividb'].includes(r))) {
  const cao = doc(`${GOC}/${ai}/01_da_cao/${lo}.jsonl`).find((r) => r.repo === repo);
  const loi = doc(`${GOC}/${ai}/04_loi/${lo}.jsonl`).find((r) => r.repo === repo);
  const goc: string = cao.readmeEn;
  const ct = phanTichReadme(goc);
  console.log(`--- ${repo}`);
  for (const doan of ct.doan) {
    const vi = loi.doan.find((d: { stt: number }) => d.stt === doan.stt)?.vi ?? '';
    const ph = (s: string) => (s.match(/⟦C\d+⟧/g) ?? []).join('');
    const bt = (s: string) => (s.match(/`/g) ?? []).length;
    const ds = (s: string) => (s.match(/^\s{0,3}(?:[-+*]|\d+[.)])\s+/gm) ?? []).length;
    if (ph(doan.vanBanDaChe) !== ph(vi) || bt(doan.vanBanDaChe) !== bt(vi) || ds(doan.vanBanDaChe) !== ds(vi))
      console.log(` stt ${doan.stt}\n   GỐC ${JSON.stringify(doan.vanBanDaChe).slice(0, 260)}\n   DỊCH ${JSON.stringify(vi).slice(0, 260)}`);
  }
}

console.log('\n==== RANH GIỚI ĐOẠN ====');
for (const [ai, lo, repo] of ca.filter(([, , r]) => ['pressly/goose', 'akosbalasko/yarle', 'kividbio/kividb'].includes(r))) {
  const cao = doc(`${GOC}/${ai}/01_da_cao/${lo}.jsonl`).find((r) => r.repo === repo);
  const loi = doc(`${GOC}/${ai}/04_loi/${lo}.jsonl`).find((r) => r.repo === repo);
  const goc: string = cao.readmeEn;
  const ct = phanTichReadme(goc);
  const map = new Map<number, string>(loi.doan.map((d: { stt: number; vi: string }) => [d.stt, d.vi]));
  const dich = rapLaiReadme(goc, ct, map);
  const lg = goc.split('\n'), ld = dich.split('\n');
  console.log(`--- ${repo}: dòng ${lg.length} -> ${ld.length}`);
  // tìm dòng đầu tiên mà gốc là mục danh sách / có backtick nhưng bản dịch tương ứng không giữ dấu đầu dòng
  let j = 0;
  for (let i = 0; i < lg.length && j < ld.length; i++, j++) {
    const a = /^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(lg[i]!), b = /^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(ld[j]!);
    const ta = (lg[i]!.match(/`/g) ?? []).length, tb = (ld[j]!.match(/`/g) ?? []).length;
    if (a !== b || ta !== tb) {
      console.log(` dòng ${i + 1}\n   GỐC ${JSON.stringify(lg[i]).slice(0, 220)}\n   DỊCH ${JSON.stringify(ld[j]).slice(0, 220)}`);
      break;
    }
  }
}

console.log('\n==== YARLE INLINE + KIVIDB DS ====');
for (const [ai, lo, repo] of ca.filter(([, , r]) => ['akosbalasko/yarle', 'kividbio/kividb'].includes(r))) {
  const cao = doc(`${GOC}/${ai}/01_da_cao/${lo}.jsonl`).find((r) => r.repo === repo);
  const loi = doc(`${GOC}/${ai}/04_loi/${lo}.jsonl`).find((r) => r.repo === repo);
  const goc: string = cao.readmeEn;
  const map = new Map<number, string>(loi.doan.map((d: { stt: number; vi: string }) => [d.stt, d.vi]));
  const dich = rapLaiReadme(goc, phanTichReadme(goc), map);
  if (repo.includes('yarle')) console.log(' inline mới:', JSON.stringify(khac(inlineMoi(goc), inlineMoi(dich))).slice(0, 600));
  else {
    const mg = muc(goc).map((x) => x.trim().slice(0, 50)), md = muc(dich).map((x) => x.trim().slice(0, 50));
    console.log(' gốc có mà dịch thiếu (theo vị trí):');
    for (let i = 0; i < mg.length; i++) if (!md[i] || (mg[i]!.slice(0, 3) !== md[i]!.slice(0, 3))) { console.log('  #', i, mg[i], '|', md[i]); break; }
  }
}
