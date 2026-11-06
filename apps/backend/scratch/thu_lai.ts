import * as fs from 'fs';
import { kiemTraDongDaDich } from '../src/scripts/data-repo/data-repo.core';
const GOC = 'E:/Du_An_Ca_Nhan/BaocaoForgeStore/Dich_Hang_Loat_V2';
const doc = (p: string) => fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const ca: Array<[string, string, string]> = [
  ['Anti', 'dich2-l025', 'konvajs/konva'], ['Anti', 'dich2-l031', 'pressly/goose'],
  ['Anti', 'dich2-l032', 'File-New-Project/EarTrumpet'], ['Anti', 'dich2-l032', 'TEN-framework/ten-framework'],
  ['Anti', 'dich2-l068', 'Baekalfen/PyBoy'], ['DeepSeek', 'dich2-l207', 'akosbalasko/yarle'],
  ['DeepSeek', 'dich2-l284', 'securisec/chepy'], ['CommandCode', 'dich2-l292', 'kividbio/kividb'],
];
for (const [ai, lo, repo] of ca) {
  const cao = doc(`${GOC}/${ai}/01_da_cao/${lo}.jsonl`).find((r) => r.repo === repo);
  const dich = doc(`${GOC}/${ai}/03_da_dich/${lo}.jsonl`).find((r) => r.repo === repo);
  const kq = kiemTraDongDaDich(cao, dich, 'thu') as { dat: unknown; loi?: { loiReadme?: string; doan?: Array<{ stt: number; loi?: string }> } };
  const loiDoan = (kq.loi?.doan ?? []).filter((d) => d.loi).map((d) => `${d.stt}:${d.loi}`);
  console.log(repo.padEnd(32), kq.dat ? 'ĐẠT' : `LỖI ${kq.loi?.loiReadme ?? ''} ${loiDoan.join(' ')}`);
}
