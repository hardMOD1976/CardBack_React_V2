import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, SupportedLanguage, LanguageOption } from '../../contexts/LanguageContext';
import { ChevronDown, Check } from 'lucide-react';

const LanguageFlag: React.FC<{ option: LanguageOption; className: string }> = ({ option, className }) => {
  if (option.code === 'ca') {
    return (
      <svg
        aria-label="Senyera catalana"
        role="img"
        viewBox="0 0 24 16"
        className={`${className} shrink-0 overflow-hidden rounded-[3px] border border-black/10`}
      >
        <rect width="24" height="16" fill="#FCDD09" />
        <path d="M0 3h24M0 6.5h24M0 10h24M0 13.5h24" stroke="#DA121A" strokeWidth="1.5" />
      </svg>
    );
  }

  return <span aria-hidden="true" className={`${className} shrink-0 text-center leading-none`}>{option.flag}</span>;
};

export const LanguageSelector: React.FC<{ compact?: boolean; showName?: boolean; className?: string }> = ({ 
  compact = false, 
  showName = false,
  className = ''
}) => {
  const { currentLanguage, setLanguage, languages, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = languages.find(l => l.code === currentLanguage) || languages[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative inline-flex items-center h-9 shrink-0 ${isOpen ? 'z-[100]' : 'z-auto'}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('common.language', 'Language')}
        title={t('common.language', 'Language')}
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs font-semibold shadow-xs bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs shrink-0 select-none ${className}`}
      >
        <LanguageFlag option={currentOption} className="h-3.5 w-5" />
        {!compact && <span className={showName ? 'inline' : 'hidden xl:inline'}>{showName ? currentOption.nativeName : currentOption.name}</span>}
        {compact && <span className="uppercase text-[11px] font-mono">{currentOption.code}</span>}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-amber-500' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-52 max-w-[calc(100vw-1.5rem)] max-h-[min(75vh,380px)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[100] py-1.5 animate-fadeIn scrollbar-thin">
          <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 z-10">
            {t('common.language', 'Language')}
          </div>
          {languages.map((lang) => {
            const isSelected = lang.code === currentLanguage;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code as SupportedLanguage);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <LanguageFlag option={lang} className="h-4 w-6 text-base" />
                  <div>
                    <span className="block leading-tight">{lang.name}</span>
                    <span className="text-[10px] text-slate-400">{lang.nativeName}</span>
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-amber-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
