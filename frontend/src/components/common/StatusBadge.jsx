import React from 'react';
import { ShieldCheck, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';

export const StatusBadge = ({ status, size = 'md' }) => {
  const normalized = (status || '').toUpperCase();

  const configs = {
    COMPLIANT: {
      label: 'COMPLIANT',
      description: 'Rule 6 Declarations Verified',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: ShieldCheck,
    },
    POTENTIALLY_NON_COMPLIANT: {
      label: 'POTENTIALLY NON-COMPLIANT',
      description: 'Potential Statutory Violation',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertTriangle,
    },
    REQUIRES_MANUAL_REVIEW: {
      label: 'REQUIRES MANUAL REVIEW',
      description: 'Physical Verification Needed',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: HelpCircle,
    },
    PROCESSING: {
      label: 'PROCESSING',
      description: 'AI OCR Pipeline Active',
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: Loader2,
    },
  };

  const config = configs[normalized] || {
    label: normalized || 'UNKNOWN',
    description: '',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: HelpCircle,
  };

  const Icon = config.icon;
  const isSpin = normalized === 'PROCESSING';

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border shadow-xs ${config.bg} ${sizeClasses[size] || sizeClasses.md}`}
      title={config.description}
    >
      <Icon className={`w-3.5 h-3.5 ${isSpin ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </span>
  );
};
