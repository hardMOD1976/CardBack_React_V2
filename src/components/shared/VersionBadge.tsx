import React, { useState } from 'react';
import { APP_VERSION } from '../../config/version';
import { VersionModal } from './VersionModal';
import { GitBranch, Sparkles } from 'lucide-react';

export interface VersionBadgeProps {
  variant?: 'header' | 'footer' | 'pill';
  className?: string;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({ variant = 'header', className = '' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (variant === 'footer') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/40 transition-all cursor-pointer ${className}`}
          title="Fes clic per veure les funcionalitats disponibles i el registre de versions"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Versió {APP_VERSION.version}</span>
          <span className="text-[10px] text-slate-400">(Què puc testejar?)</span>
        </button>
        <VersionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        id="app-version-badge-btn"
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all cursor-pointer border shadow-2xs group ${
          variant === 'pill'
            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-amber-400/50'
        } ${className}`}
        title="Fes clic per veure la versió desplegada i les funcions que pots provar"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-bold tracking-tight">{APP_VERSION.version}</span>
        <span className="hidden sm:inline text-[10px] text-slate-400 dark:text-slate-500 font-normal group-hover:text-amber-500 transition-colors">
          • Què puc testejar?
        </span>
      </button>
      <VersionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
