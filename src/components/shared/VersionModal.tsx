import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { APP_VERSION } from '../../config/version';
import { CbButton } from './CbButton';
import { 
  GitBranch, 
  CheckCircle2, 
  Sparkles, 
  Calendar, 
  Layers, 
  ShieldCheck, 
  X, 
  ExternalLink,
  Tag,
  Info
} from 'lucide-react';

export interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VersionModal: React.FC<VersionModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
                  Control de Versions & Estat de Desplegament
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono font-bold text-[11px] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {APP_VERSION.version}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data de compilació: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{APP_VERSION.buildDate}</span> • {APP_VERSION.environment}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Release Headline Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {APP_VERSION.releaseTitle}
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                Aquesta versió activa assegura que les figures creades o editades manualment es guardin amb persistència sense pèrdua, recupera el selector visual de la foto de portada i resol la fiabilitat del reconeixement per codi de barres i visió IA.
              </p>
            </div>
          </div>

          {/* Section: What can you test right now? */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Què pots testejar en aquesta versió ({APP_VERSION.version})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">{APP_VERSION.testableFeatures.length} funcionalitats verificades</span>
            </div>

            <div className="space-y-2.5">
              {APP_VERSION.testableFeatures.map((feat, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2 shadow-xs overflow-hidden"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {feat.status === 'updated' ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold font-mono border border-amber-500/40 shrink-0">
                          ACTUALITZAT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono border border-emerald-500/40 shrink-0">
                          DISPONIBLE
                        </span>
                      )}
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                        {feat.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {feat.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {feat.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono font-medium"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Changelog */}
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Historial recent de canvis (Changelog)</span>
            </h4>

            <div className="space-y-3">
              {APP_VERSION.changelog.map((entry, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="font-mono text-amber-600 dark:text-amber-400">{entry.version}</span>
                      <span>— {entry.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{entry.date}</span>
                  </div>
                  <ul className="text-xs text-slate-700 dark:text-slate-200 space-y-1 pl-4 list-disc">
                    {entry.highlights.map((h, hIdx) => (
                      <li key={hIdx}>{h}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Cardback Archivist • Versió {APP_VERSION.version}
          </span>
          <CbButton size="sm" variant="amber" onClick={onClose}>
            Entès, tancar
          </CbButton>
        </div>
      </div>
    </div>,
    document.body
  );
};
