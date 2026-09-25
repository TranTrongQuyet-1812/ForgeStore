import React from 'react';
import { LayoutGrid, Code, Film, Shield, Wrench, FileText, Gamepad2 } from 'lucide-react';
import { useNavStore } from '../stores/useNavStore';

const CATEGORIES_DATA = [
  {
    name: 'Công cụ lập trình',
    desc: 'IDE, Text Editor, Git Tools, Terminal',
    count: 4,
    icon: Code,
    color: 'text-sky-400',
  },
  {
    name: 'Đa phương tiện',
    desc: 'Trình xem video, nghe nhạc, ghi màn hình',
    count: 5,
    icon: Film,
    color: 'text-amber-400',
  },
  {
    name: 'Bảo mật & Quyền riêng tư',
    desc: 'Trình quản lý mật khẩu, VPN, mã hóa',
    count: 3,
    icon: Shield,
    color: 'text-emerald-400',
  },
  {
    name: 'Tiện ích hệ thống',
    desc: 'Điều khiển từ xa, tối ưu máy, nén file',
    count: 6,
    icon: Wrench,
    color: 'text-accent-forge',
  },
  {
    name: 'Văn phòng & Ghi chú',
    desc: 'Markdown, sổ tay kiến thức, PDF viewer',
    count: 3,
    icon: FileText,
    color: 'text-purple-400',
  },
  {
    name: 'Trò chơi mã nguồn mở',
    desc: 'Game retro, emulator, indie FOSS games',
    count: 1,
    icon: Gamepad2,
    color: 'text-rose-400',
  },
];

export const CategoriesPage: React.FC = () => {
  const { navigateTo } = useNavStore();

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full select-none">
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold font-display text-primary flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-accent-ai" />
          <span>Danh Mục Ứng Dụng</span>
        </h1>
        <p className="text-xs text-muted mt-1">
          Duyệt các phần mềm mã nguồn mở được phân loại theo lĩnh vực chuyên môn
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES_DATA.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.name}
              onClick={() => navigateTo('explore')}
              className="p-5 rounded-2xl bg-surface border border-border hover:border-border-focus hover:bg-surface-hover cursor-pointer transition-all duration-200 flex flex-col justify-between min-h-[140px] group"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center ${cat.color} group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-elevated text-muted text-[11px] font-mono">
                  {cat.count} apps
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold font-display text-primary group-hover:text-accent-forge transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs text-secondary mt-1 line-clamp-1">{cat.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
