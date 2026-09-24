import { KetQuaChangelog, KetQuaTomTat } from '../dto/ai-summary.dto';

export type TenNhaCungCap = 'GEMINI' | 'NVIDIA_NIM';

/**
 * Interface chuẩn cho các nhà cung cấp mô hình ngôn ngữ lớn (P2-39.2).
 * Cả Gemini và NVIDIA NIM đều dùng chung interface này.
 */
export interface INhaCungCapTomTat {
  readonly ten: TenNhaCungCap;
  readonly tenModel: string;

  /**
   * Tóm tắt README thành khẩu hiệu và danh sách tính năng kèm trích dẫn nguyên văn.
   */
  tomTatReadme(readme: string, repoName: string): Promise<KetQuaTomTat>;

  /**
   * Tóm tắt Changelog bản phát hành thành các điểm mới tiếng Việt.
   */
  tomTatChangelog(changelog: string, repoName: string): Promise<KetQuaChangelog>;
}
