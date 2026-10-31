import React from 'react';

interface NhanLuuTruProps {
  daLuuTru?: boolean;
}

export const NhanLuuTru: React.FC<NhanLuuTruProps> = ({ daLuuTru }) => {
  if (!daLuuTru) return null;
  return (
    <span
      role="status"
      aria-label="Đã ngừng phát triển"
      className="inline-flex px-1.5 py-0.5 rounded border border-border bg-surface-elevated text-secondary text-[10px] font-medium"
    >
      Đã ngừng phát triển
    </span>
  );
};
