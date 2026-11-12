/**
 * Lõi thuần của lệnh `liet-ke` (D-39, P3B-37.3): sàng repo theo siêu dữ liệu GitHub Search (chủ đề, mô tả) trước khi tốn
 * lượt gọi lấy README và release. Chủ chốt 12/11/2026: ưu tiên AI, phần mềm cài trực tiếp và portable; thư viện lập trình,
 * ngôn ngữ lập trình, framework thì bỏ. Không gọi mạng, không chạm DB.
 */

export interface MetaRepo {
  full_name: string;
  description: string | null;
  topics?: string[];
}

/** Chủ đề cho biết đây là thư viện, ngôn ngữ, framework, tài liệu học, bộ mẫu hoặc tiện ích gắn vào phần mềm khác. */
const CHU_DE_BO = new Set([
  'library',
  'libraries',
  'framework',
  'frameworks',
  'sdk',
  'api-client',
  'api-wrapper',
  'bindings',
  'programming-language',
  'compiler',
  'interpreter',
  'transpiler',
  'orm',
  'awesome',
  'awesome-list',
  'tutorial',
  'tutorials',
  'course',
  'boilerplate',
  'starter',
  'starter-kit',
  'template',
  'cheatsheet',
  'interview',
  'roadmap',
  'book',
  'dotfiles',
  'react-component',
  'vue-component',
  'chrome-extension',
  'firefox-addon',
  'browser-extension',
  'vscode-extension',
  'obsidian-plugin',
  'wordpress-plugin',
  'home-assistant',
  'hacs',
]);

/** Mô tả tự nhận là thư viện/framework/SDK/ngôn ngữ: "X là một <vài từ> library", hoặc cụm danh từ ở đầu mô tả. */
const MAU_MO_TA_BO =
  /(?:^|\b(?:is|are)\s+)(?:an?|the)\s+(?:[\w.+#-]+\s+){0,4}(?:library|libraries|framework|sdk|toolkit|bindings|plug-?in|boilerplate|compiler|interpreter|transpiler)\b|^(?:[\w.+#-]+\s+){0,3}(?:library|framework|sdk|toolkit|bindings|boilerplate|template|starter)\b|\b(?:programming|scripting) language\b|\bawesome (?:list|collection)\b|\bcurated list\b|\b(?:tutorial|course|cheat ?sheet)s?\b|\bcomponent library\b|\bui kit\b|\bdesign system\b/i;

/** Lý do bỏ (để thống kê) hoặc null nếu giữ. */
export function lyDoBoTheoSieuDuLieu(m: MetaRepo): string | null {
  for (const t of m.topics ?? [])
    if (CHU_DE_BO.has(t.toLowerCase())) return `chu-de:${t.toLowerCase()}`;
  const mota = (m.description ?? '').trim();
  if (mota && MAU_MO_TA_BO.test(mota)) return 'mo-ta:thu-vien-framework-ngon-ngu';
  return null;
}

const CHU_DE_AI = new Set([
  'ai',
  'artificial-intelligence',
  'llm',
  'llms',
  'machine-learning',
  'deep-learning',
  'generative-ai',
  'chatgpt',
  'gpt',
  'openai',
  'claude',
  'gemini',
  'ollama',
  'agent',
  'agents',
  'ai-agent',
  'ai-agents',
  'mcp',
  'rag',
  'stable-diffusion',
  'whisper',
  'text-to-speech',
  'speech-recognition',
  'ocr',
]);
const MAU_AI =
  /\b(?:AI|LLMs?|GPT|ChatGPT|Claude|Gemini|Ollama|agents?|machine learning|neural|diffusion|Whisper|MCP|RAG|copilot)\b/;

const CHU_DE_PHAN_MEM_CAI_TRUC_TIEP = new Set([
  'windows',
  'desktop',
  'desktop-app',
  'desktop-application',
  'electron',
  'tauri',
  'gui',
  'portable',
  'installer',
  'winget',
  'scoop',
  'app',
  'application',
  'wpf',
  'winui',
  'qt',
  'flutter-desktop',
  'cross-platform',
]);
const MAU_PHAN_MEM_CAI_TRUC_TIEP =
  /\b(?:desktop (?:app|application|client)|windows (?:app|application|tool|utility)|for windows|portable|installer|gui|system tray|menu ?bar app)\b/i;

/** Hạng ưu tiên: 1 = AI, 2 = phần mềm cài trực tiếp/portable, 3 = còn lại. */
export function mucUuTien(m: MetaRepo): 1 | 2 | 3 {
  const chuDe = (m.topics ?? []).map((t) => t.toLowerCase());
  const mota = m.description ?? '';
  if (chuDe.some((t) => CHU_DE_AI.has(t)) || MAU_AI.test(mota)) return 1;
  if (
    chuDe.some((t) => CHU_DE_PHAN_MEM_CAI_TRUC_TIEP.has(t)) ||
    MAU_PHAN_MEM_CAI_TRUC_TIEP.test(mota)
  )
    return 2;
  return 3;
}
