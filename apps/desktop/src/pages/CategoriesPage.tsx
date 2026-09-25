import React from 'react';
import {
  LayoutGrid,
  Code,
  Film,
  Shield,
  Wrench,
  FileText,
  Gamepad2,
  Radio,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import { useNavStore } from '../stores/useNavStore';

const CATEGORIES_DATA = [
  {
    name: 'Lập trình & Phát triển',
    desc: 'IDE, Text Editor, Git Tools, Terminal, Dev Environments',
    count: '14+ apps',
    icon: Code,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    name: 'Tiện ích hệ thống',
    desc: 'Điều khiển từ xa, tối ưu hệ điều hành, giải nén, clipboard',
    count: '18+ apps',
    icon: Wrench,
    color: 'text-accent-forge bg-orange-500/10 border-orange-500/20',
  },
  {
    name: 'Đa phương tiện',
    desc: 'Trình phát video, nghe nhạc, ghi hình màn hình, biên tập',
    count: '12+ apps',
    icon: Film,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    name: 'Bảo mật & Quyền riêng tư',
    desc: 'Quản lý mật khẩu, VPN mã hóa, 2FA authenticator, che chắn',
    count: '9+ apps',
    icon: Shield,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'Năng suất & Văn phòng',
    desc: 'Ghi chú Second Brain, Markdown, PDF reader, bảng tính',
    count: '15+ apps',
    icon: FileText,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    name: 'Mạng & Giao tiếp',
    desc: 'Trình duyệt bảo mật, chat P2P, truyền tệp LAN, torrent',
    count: '8+ apps',
    icon: Radio,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    name: 'Học tập & Giáo dục',
    desc: 'Phần mềm toán học, học ngoại ngữ, tra cứu mã nguồn, flashcard',
    count: '6+ apps',
    icon: GraduationCap,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    name: 'Trò chơi mã nguồn mở',
    desc: 'Game indie, game engine FOSS, retro emulator, minigames',
    count: '5+ apps',
    icon: Gamepad2,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
];

export const CategoriesPage: React.FC = () => {
  const { openCategory } = useNavStore();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full select-none">
      {/* Tiêu đề trang */}
      <div className="border-b border-border/60 pb-4">
        <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-accent-ai" />
          <span>Danh Mục Ứng Dụng Chuyên Sâu</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Duyệt kho ứng dụng mã nguồn mở được tuyển chọn và thẩm định an toàn theo lĩnh vực
        </p>
      </div>

      {/* Lưới 8 danh mục CSDL sống */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES_DATA.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.name}
              onClick={() => openCategory(cat.name)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openCategory(cat.name);
                }
              }}
              className="tactile-card p-5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[160px] group focus-visible:ring-2 focus-visible:ring-accent-forge outline-none"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border ${cat.color} group-hover:scale-105 transition-transform duration-200 shadow-sm`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-elevated text-muted text-[11px] font-mono font-medium border border-border/50">
                  {cat.count}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-display text-primary group-hover:text-accent-forge transition-colors line-clamp-1">
                    {cat.name}
                  </h3>
                  <ArrowRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-[11px] text-secondary mt-1 line-clamp-2 leading-relaxed font-normal">
                  {cat.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
