import React from 'react';
import { 
  Sparkles, 
  ScanBarcode, 
  PlusCircle, 
  Search, 
  X, 
  ChevronRight,
  Camera,
  Layers,
  FileEdit
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AddFigureChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChooseAi: () => void;
  onChooseBarcode: () => void;
  onChooseManual: () => void;
  onChooseCatalogue: () => void;
}

export const AddFigureChoiceModal: React.FC<AddFigureChoiceModalProps> = ({
  isOpen,
  onClose,
  onChooseAi,
  onChooseBarcode,
  onChooseManual,
  onChooseCatalogue
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto text-slate-900 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex-shrink-0 p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
                {t('collection.add_choice_title', 'Com vols afegir la teva figura?')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('collection.add_choice_subtitle', 'Tria el mètode que prefereixis per registrar una figura d\'acció')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Tancar')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">

          {/* Option 1: AI Visual Recognition */}
          <button
            type="button"
            onClick={onChooseAi}
            className="w-full text-left p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-transparent hover:from-cyan-500/20 hover:border-cyan-500/50 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs"
          >
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                  {t('collection.choice_ai_title', 'Reconeixement fotogràfic amb IA')}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                  {t('collection.choice_ai_badge', 'IA Visual')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('collection.choice_ai_desc', 'Fes una foto o carrega una imatge de la teva figura. La IA n\'identificarà el personatge, fabricant, variant i estat.')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>

          {/* Option 2: Barcode Scanner */}
          <button
            type="button"
            onClick={onChooseBarcode}
            className="w-full text-left p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent hover:from-emerald-500/20 hover:border-emerald-500/50 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 group-hover:scale-105 transition-transform">
              <ScanBarcode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                  {t('collection.choice_barcode_title', 'Escàner de codi de barres')}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  {t('collection.choice_barcode_badge', 'Ràpid')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('collection.choice_barcode_desc', 'Apunta amb la càmera del mòbil al codi de barres del blíster o de la caixa per trobar la figura al catàleg.')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>

          {/* Option 3: Manual Entry (Blank Form) */}
          <button
            type="button"
            onClick={onChooseManual}
            className="w-full text-left p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent hover:from-amber-500/20 hover:border-amber-500/50 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30 group-hover:scale-105 transition-transform">
              <FileEdit className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                  {t('collection.choice_manual_title', 'Crear figura a mà (Formulari en blanc)')}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                  {t('collection.choice_manual_badge', 'A mà')}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('collection.choice_manual_desc', 'Emplena una fitxa des de zero: nom, línia, foto pròpia, estat (MOC, Loose, Graded), preu de compra i ubicació.')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>
        </div>

        {/* Footer with catalogue search alternative */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {t('collection.choice_catalogue_hint', 'O prefereixes buscar entre les figures del catàleg existent?')}
          </span>
          <button
            type="button"
            onClick={onChooseCatalogue}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer shadow-2xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{t('collection.choice_catalogue_btn', 'Explorar Catàleg')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
