import React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { NGUONG_AN_TOAN_CAO, NGUONG_CAN_LUU_Y } from '@forgestore/types';

interface TrustPillProps {
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onClick?: () => void;
}

export const NhanTinCay: React.FC<TrustPillProps> = ({
  score,
  size = 'md',
  showLabel = false,
  onClick,
}) => {
  if (score === null || score === undefined || score === 0) {
    const sizeStyles = {
      sm: 'px-1.5 py-0.5 text-[10px]',
      md: 'px-2 py-0.5 text-xs',
      lg: 'px-2.5 py-1 text-sm',
    }[size];

    return (
      <span
        className={`inline-flex items-center font-mono text-muted rounded-full border border-border/60 bg-surface-elevated/40 ${sizeStyles}`}
        title="Ứng dụng chưa qua đánh giá điểm uy tín"
      >
        Chưa đánh giá
      </span>
    );
  }

  const isHigh = score >= NGUONG_AN_TOAN_CAO;
  const isMedium = score >= NGUONG_CAN_LUU_Y && score < NGUONG_AN_TOAN_CAO;

  const colorStyles = isHigh
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50'
    : isMedium
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:border-amber-500/50'
      : 'bg-red-500/10 text-red-400 border-red-500/30 hover:border-red-500/50';

  const Icon = isHigh ? ShieldCheck : isMedium ? AlertTriangle : ShieldAlert;

  const label = isHigh ? 'An toàn' : isMedium ? 'Lưu ý' : 'Rủi ro';

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center font-mono font-bold rounded-full border transition-all duration-150 ${colorStyles} ${sizeStyles}`}
      title={
        score !== null && score !== undefined
          ? `Điểm uy tín: ${score}/100 (${label})`
          : 'Điểm uy tín: Chưa đánh giá'
      }
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-tnum">{score}/100</span>
      {showLabel && <span className="font-sans font-medium text-[11px] ml-0.5">• {label}</span>}
    </button>
  );
};
