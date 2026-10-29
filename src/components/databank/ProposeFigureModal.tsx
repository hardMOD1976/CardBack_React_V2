import React, { useState } from 'react';
import { CbCard } from '../shared/CbCard';
import { CbButton } from '../shared/CbButton';
import { 
  PlusCircle, 
  UploadCloud, 
  Check, 
  AlertCircle, 
  X, 
  Sparkles, 
  Film, 
  Tag, 
  Calendar, 
  Barcode, 
  FileText,
  ShieldCheck,
  BookmarkCheck,
  Heart,
  Eye,
  Trash2,
  Star,
  Plus
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { ApiService } from '../../services/apiService';
import { compressImage } from '../../utils/imageCompressor';
import { CollectionService } from '../../services/collectionService';
import { FigureCondition } from '../../types/domain';

interface ProposeFigureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function mapToFigureCondition(cond: string): FigureCondition {
  if (cond === 'MOC' || cond === 'MIB' || cond === 'CARDED_DAMAGED') return 'MOC';
  if (cond === 'LOOSE_COMPLETE') return 'LOOSE_COMPLETE';
  if (cond === 'LOOSE_INCOMPLETE' || cond === 'LOOSE_PLAYED') return 'LOOSE_INCOMPLETE';
  if (cond === 'GRADED') return 'GRADED';
  return 'CUSTOM';
}

const FRANCHISE_OPTIONS = [
  'Star Wars',
  'Masters of the Universe',
  'Teenage Mutant Ninja Turtles',
  'Marvel',
  'DC Comics / Batman',
  'Transformers',
  'G.I. Joe',
  'Jurassic Park',
  'ThunderCats',
  'Anime / Manga',
  'Altra franquícia'
];

const MANUFACTURER_OPTIONS = [
  'Hasbro',
  'Kenner',
  'Mattel',
  'Playmates Toys',
  'NECA',
  'McFarlane Toys',
  'Bandai / Tamashii Nations',
  'Super7',
  'Funko',
  'Mezco Toyz',
  'Toy Biz',
  'LJN',
  'Lewis Galoob Toys',
  'Mego',
  'Altre fabricant'
];

const AVAILABLE_LINES = [
  { id: 'line-sw-vintage', name: 'Vintage Star Wars Kenner (1977–1985)', franchise: 'Star Wars', mfr: 'Kenner' },
  { id: 'line-sw-potf-1985', name: 'The Power of the Force - Coin Line (1985)', franchise: 'Star Wars', mfr: 'Kenner' },
  { id: 'line-sw-potf2', name: 'The Power of the Force 2 (1995–2000)', franchise: 'Star Wars', mfr: 'Hasbro / Kenner' },
  { id: 'line-sw-celebration', name: 'Star Wars Celebration Exclusives', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-saga', name: 'Star Wars Saga Collection (2002–2006)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-ep1', name: 'Episode I: The Phantom Menace (1999)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-aotc', name: 'Episode II: Attack of the Clones - Blue Card (2002–2004)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-votc', name: 'Vintage Original Trilogy Collection / VOTC (2004)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-tac', name: '30th Anniversary Collection / TAC (2007)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-tvc', name: 'The Vintage Collection / TVC (2010–Present)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-tbs', name: 'The Black Series 6" (2013–Present)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-retro', name: 'Retro Collection (2019–Present)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-sw-mandalorian', name: 'The Mandalorian Line (2019–Present)', franchise: 'Star Wars', mfr: 'Hasbro' },
  { id: 'line-motu-vintage', name: 'Masters of the Universe Vintage (1982-1988)', franchise: 'Masters of the Universe', mfr: 'Mattel' },
  { id: 'line-motu-origins', name: 'Masters of the Universe Origins', franchise: 'Masters of the Universe', mfr: 'Mattel' },
  { id: 'line-tmnt-1988', name: 'TMNT Vintage (1988)', franchise: 'Teenage Mutant Ninja Turtles', mfr: 'Playmates Toys' },
  { id: 'line-custom', name: 'Altra línia (personalitzada)', franchise: 'Altres', mfr: 'Altre' }
];

export const ProposeFigureModal: React.FC<ProposeFigureModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [franchiseName, setFranchiseName] = useState('Star Wars');
  const [customFranchise, setCustomFranchise] = useState('');
  const [manufacturerName, setManufacturerName] = useState('Hasbro');
  const [customManufacturer, setCustomManufacturer] = useState('');
  const [lineId, setLineId] = useState('line-sw-tvc');
  const [customLineName, setCustomLineName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [ownershipStatus, setOwnershipStatus] = useState<'OWNED' | 'WISHLIST' | 'NONE'>('OWNED');
  const [condition, setCondition] = useState('MOC');
  const [conditionDetails, setConditionDetails] = useState('');
  const [barcode, setBarcode] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [description, setDescription] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const compressed = await compressImage(file, 800, 0.75);
        if (compressed) {
          let finalUrl = compressed;
          try {
            const uploadRes = await fetch('/api/upload/image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: compressed }),
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json().catch(() => null);
              if (uploadData?.url) {
                finalUrl = uploadData.url;
              }
            }
          } catch (uploadErr) {
            console.warn('Could not persist to storage endpoint:', uploadErr);
          }
          setImages(prev => prev.includes(finalUrl) ? prev : [...prev, finalUrl]);
        }
      } catch (err) {
        console.warn('Could not compress figure image:', err);
      }
    }
    e.target.value = '';
  };

  const handleAddImageUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!images.includes(trimmed)) {
      setImages(prev => [...prev, trimmed]);
    }
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSetPrimaryImage = (indexToPromote: number) => {
    setImages(prev => {
      const target = prev[indexToPromote];
      if (!target) return prev;
      return [target, ...prev.filter((_, idx) => idx !== indexToPromote)];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage(t('propose.error', 'Cal indicar com a mínim el nom de la figura.'));
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const resolvedFranchise = franchiseName.trim() === 'Altra franquícia' ? (customFranchise.trim() || 'Altres') : (franchiseName.trim() || 'Altres');
      const resolvedManufacturer = manufacturerName.trim() === 'Altre fabricant' ? (customManufacturer.trim() || 'Altres') : (manufacturerName.trim() || 'Hasbro');
      const lineObj = AVAILABLE_LINES.find(l => l.id === lineId);
      const resolvedLineName = lineId === 'line-custom' ? (customLineName.trim() || 'Línia Personalitzada') : (lineObj?.name || 'The Vintage Collection');

      const primaryImage = images[0] || undefined;
      const payload = {
        name: name.trim(),
        characterName: characterName.trim() || name.trim(),
        lineId,
        lineName: resolvedLineName,
        franchiseName: resolvedFranchise,
        manufacturerName: resolvedManufacturer,
        year: parseInt(year, 10) || new Date().getFullYear(),
        condition,
        conditionDetails: conditionDetails.trim() || undefined,
        barcode: barcode.trim() || undefined,
        imageUrl: primaryImage,
        images: images.length > 0 ? images : undefined,
        description: description.trim() || undefined,
        userNotes: userNotes.trim() || undefined
      };

      let serverFigure: any = null;
      try {
        const res = await fetch('/api/catalog/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          serverFigure = data?.figure;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend catalog propose returned non-ok:', errData?.error || res.statusText);
        }
      } catch (netErr) {
        console.warn('Backend catalog propose unreachable, continuing with local persistence:', netErr);
      }

      // Always register immediately in frontend store & localStorage for instant persistence
      const generatedId = serverFigure?.id || `fig-custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const registeredFig = ApiService.registerCommunityProposal({
        id: generatedId,
        name: name.trim(),
        year: parseInt(year, 10) || new Date().getFullYear(),
        lineId,
        lineName: resolvedLineName,
        franchiseName: resolvedFranchise,
        manufacturerName: resolvedManufacturer,
        characterName: characterName.trim() || name.trim(),
        condition,
        conditionDetails: conditionDetails.trim() || undefined,
        barcode: barcode.trim() || undefined,
        imageUrl: primaryImage,
        description: description.trim() || undefined
      });

      // Automatically add to personal user collection or wishlist if selected
      const targetFig = registeredFig || serverFigure;
      if (targetFig && (ownershipStatus === 'OWNED' || ownershipStatus === 'WISHLIST')) {
        let currentUserId = 'anonymous';
        try {
          const uStr = localStorage.getItem('cb_user');
          if (uStr) currentUserId = JSON.parse(uStr)?.id || 'anonymous';
        } catch {}

        CollectionService.addFigure({
          userId: currentUserId,
          figureId: targetFig.id,
          figureName: targetFig.name || name.trim(),
          figureCode: targetFig.code || (barcode ? `BC-${barcode.slice(-6)}` : undefined),
          figureImageUrl: targetFig.imageUrl || primaryImage || '/cardback_placeholder.jpeg',
          images: images.length > 0 ? images : [targetFig.imageUrl || primaryImage || '/cardback_placeholder.jpeg'],
          lineId: lineId,
          lineName: resolvedLineName,
          franchiseId: `fran-${resolvedFranchise.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          franchiseName: resolvedFranchise,
          condition: mapToFigureCondition(condition),
          gradingScore: condition === 'GRADED' ? conditionDetails : undefined,
          purchasePrice: 0,
          currency: 'USD',
          estimatedValue: condition === 'GRADED' ? 120 : (condition === 'MOC' || condition === 'MIB' ? 35 : 18),
          acquisitionDate: new Date().toISOString().split('T')[0],
          quantity: 1,
          storageLocation: 'Vitrina de Col·leccionista',
          collectorNotes: [conditionDetails, userNotes].filter(Boolean).join(' - ') || undefined,
          isWishlist: ownershipStatus === 'WISHLIST',
          priority: ownershipStatus === 'WISHLIST' ? 'Medium' : undefined
        });
      }

      setSuccessMessage(t('propose.success', 'Gràcies! La figura ha quedat registrada directament al catàleg comunitari i a la teva col·lecció.'));
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setName('');
        setCharacterName('');
        setOwnershipStatus('OWNED');
        setCondition('MOC');
        setConditionDetails('');
        setBarcode('');
        setImages([]);
        setUrlInput('');
        setDescription('');
        setUserNotes('');
        setSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(t('propose.error', 'The figure proposal could not be saved.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-display">
                {t('propose.modal_title', 'Proposar Nova Figura al Catàleg')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('propose.modal_subtitle', 'Model tipus Viquipèdia / Discogs: Afegeix figures, variants o fotos pròpies per ampliar la base de dades.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close dialog')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body & Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
            {/* Status Alerts */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Figure Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                {t('propose.name', 'Nom de la Figura *')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('propose.example_figure', 'e.g. Luke Skywalker (Bespin Fatigue)')}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs"
              />
            </div>

            {/* Character Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {t('propose.character', 'Personatge')}
              </label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder={t('propose.example_character', 'e.g. Luke Skywalker')}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs"
              />
            </div>

            {/* Franchise Field */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{t('nav.franchises', 'Franquícia')} *</span>
              </label>
              <input
                list="propose-franchise-options"
                type="text"
                required
                value={franchiseName}
                onChange={(e) => setFranchiseName(e.target.value)}
                placeholder="ex. Star Wars, Masters of the Universe..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs truncate"
              />
              <datalist id="propose-franchise-options">
                {FRANCHISE_OPTIONS.filter(f => f !== 'Altra franquícia').map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            {/* Manufacturer Field */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{t('databank.manufacturer', 'Fabricant')} *</span>
              </label>
              <input
                list="propose-manufacturer-options"
                type="text"
                required
                value={manufacturerName}
                onChange={(e) => setManufacturerName(e.target.value)}
                placeholder="ex. Hasbro, Kenner, Mattel..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs truncate"
              />
              <datalist id="propose-manufacturer-options">
                {MANUFACTURER_OPTIONS.filter(m => m !== 'Altre fabricant').map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            {/* Line Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-amber-500" />
                {t('propose.line', 'Línia de Joguines')}
              </label>
              <select
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs"
              >
                {AVAILABLE_LINES.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
              {lineId === 'line-custom' && (
                <input
                  type="text"
                  value={customLineName}
                  onChange={(e) => setCustomLineName(e.target.value)}
                  placeholder="Escriu el nom de la línia de joguines..."
                  className="w-full mt-1.5 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-amber-500/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              )}
            </div>

            {/* Release Year */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                {t('propose.year', 'Any de Llançament')}
              </label>
              <input
                type="number"
                min="1970"
                max="2030"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs font-mono"
              />
            </div>

            {/* User Collection Status / Ownership Section */}
            <div className="sm:col-span-2 space-y-2.5 p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-amber-500" />
                  <span>{t('propose.ownership_label', 'Estat a la Col·lecció')}</span>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('propose.ownership_help', 'Indica si tens la figura a la teva col·lecció, si la vols a la wishlist o només catalogar')}
                </span>
              </div>

              {/* Quick Ownership Toggle Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                {[
                  {
                    id: 'OWNED' as const,
                    icon: BookmarkCheck,
                    label: t('propose.ownership_owned', 'A la meva col·lecció'),
                    sub: t('propose.ownership_owned_sub', 'Tinc aquesta figura'),
                    activeClass: 'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 ring-1 ring-emerald-500 font-semibold',
                    iconClass: 'text-emerald-500'
                  },
                  {
                    id: 'WISHLIST' as const,
                    icon: Heart,
                    label: t('propose.ownership_wishlist', 'A la Wishlist'),
                    sub: t('propose.ownership_wishlist_sub', 'Vull aconseguir-la'),
                    activeClass: 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-1 ring-amber-500 font-semibold',
                    iconClass: 'text-amber-500'
                  },
                  {
                    id: 'NONE' as const,
                    icon: Eye,
                    label: t('propose.ownership_none', 'No la tinc'),
                    sub: t('propose.ownership_none_sub', 'Només catalogar'),
                    activeClass: 'border-slate-400 bg-slate-200/60 dark:bg-slate-700/60 text-slate-900 dark:text-slate-100 ring-1 ring-slate-400 font-semibold',
                    iconClass: 'text-slate-400'
                  }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = ownershipStatus === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setOwnershipStatus(item.id)}
                      className={`w-full min-w-0 max-w-full flex items-start gap-2.5 p-2.5 rounded-lg text-xs transition-all border text-left cursor-pointer overflow-hidden ${
                        isSelected
                          ? item.activeClass
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? item.iconClass : 'text-slate-400'}`} />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="font-bold truncate">{item.label}</div>
                        <div className="text-[10px] opacity-75 truncate">{item.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Standardized Dropdown for user collection status */}
              <div className="pt-0.5 w-full min-w-0">
                <select
                  value={ownershipStatus}
                  onChange={(e) => setOwnershipStatus(e.target.value as 'OWNED' | 'WISHLIST' | 'NONE')}
                  className="w-full max-w-full min-w-0 truncate px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs"
                >
                  <option value="OWNED">{t('propose.ownership_owned', 'A la meva col·lecció')} ({t('propose.ownership_owned_sub', 'Tinc aquesta figura')})</option>
                  <option value="WISHLIST">{t('propose.ownership_wishlist', 'A la Wishlist')} ({t('propose.ownership_wishlist_sub', 'Vull aconseguir-la')})</option>
                  <option value="NONE">{t('propose.ownership_none', 'No la tinc')} ({t('propose.ownership_none_sub', 'Només catalogar')})</option>
                </select>
              </div>
            </div>

            {/* Figure Condition / State Section (Estat de Conservació) */}
            <div className="sm:col-span-2 space-y-2.5 p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-2xs w-full max-w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                  <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{t('propose.condition', 'Estat de Conservació')}</span>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {t('propose.condition_help', 'Defineix si la figura està en blíster, caixa o solta (loose)')}
                </span>
              </div>

              {/* Quick Collector Preset Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                {[
                  { id: 'MOC', label: t('propose.cond_moc', 'Mint On Card'), sub: t('propose.cond_moc_sub', 'Blíster intacte') },
                  { id: 'MIB', label: t('propose.cond_mib', 'Mint In Box'), sub: t('propose.cond_mib_sub', 'Caixa segellada') },
                  { id: 'LOOSE_COMPLETE', label: t('propose.cond_loose_comp', 'Loose Complet'), sub: t('propose.cond_loose_comp_sub', '100% accessoris') },
                  { id: 'LOOSE_INCOMPLETE', label: t('propose.cond_loose_incomp', 'Loose Incomplet'), sub: t('propose.cond_loose_incomp_sub', 'Falten peces') }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setCondition(preset.id)}
                    className={`w-full min-w-0 max-w-full px-2.5 py-2 rounded-lg text-xs transition-all border text-left cursor-pointer overflow-hidden ${
                      condition === preset.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-1 ring-amber-500 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="font-bold truncate leading-tight">{preset.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-none">{preset.sub}</div>
                  </button>
                ))}
              </div>

              {/* Standardized Dropdown & Exact Specification Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5 w-full">
                <div className="space-y-1 min-w-0 max-w-full">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block truncate">
                    {t('propose.cond_select_label', 'Estat normalitzat de catalogació')}
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full max-w-full min-w-0 truncate px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs"
                  >
                    <option value="MOC">{t('propose.cond_opt_moc', 'Mint on Card (MOC - Blíster original segellat)')}</option>
                    <option value="MIB">{t('propose.cond_opt_mib', 'Mint in Box (MIB / MISB - En caixa original segellada)')}</option>
                    <option value="CARDED_DAMAGED">{t('propose.cond_opt_carded_dmg', 'Carded amb desgast (Blíster obert, plecs o bombolla groga)')}</option>
                    <option value="LOOSE_COMPLETE">{t('propose.cond_opt_loose_comp', 'Loose Complet (C-9 / C-10 - Amb tots els accessoris originals)')}</option>
                    <option value="LOOSE_INCOMPLETE">{t('propose.cond_opt_loose_incomp', 'Loose Incomplet (Falta algun accessori, arma o capa)')}</option>
                    <option value="LOOSE_PLAYED">{t('propose.cond_opt_loose_played', 'Loose amb desgast de joc (Fregaments o articulacions toves)')}</option>
                    <option value="GRADED">{t('propose.cond_opt_graded', 'Graduada Professionalment (AFA / CAS / UKG / PSA)')}</option>
                    <option value="CUSTOM">{t('propose.cond_opt_custom', 'Customitzada / Repintada / Restaurada')}</option>
                    <option value="OTHER">{t('propose.cond_opt_other', 'Altre estat definit pel col·leccionista')}</option>
                  </select>
                </div>

                <div className="space-y-1 min-w-0 max-w-full">
                  <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 block truncate">
                    {condition === 'GRADED' 
                      ? t('propose.cond_notes_graded_label', 'Puntuació i empresa graduadora') 
                      : condition === 'LOOSE_INCOMPLETE'
                      ? t('propose.cond_notes_missing_label', 'Quines armes o peces falten?')
                      : t('propose.cond_notes_label', 'Especificació o matís de l\'estat (opcional)')}
                  </label>
                  <input
                    type="text"
                    value={conditionDetails}
                    onChange={(e) => setConditionDetails(e.target.value)}
                    placeholder={
                      condition === 'GRADED'
                        ? t('propose.example_grade', 'e.g. AFA 85 (C:85, B:85, F:85) NM+')
                        : condition === 'LOOSE_INCOMPLETE'
                        ? t('propose.example_missing_parts', 'e.g. Missing blaster or original cape')
                        : condition === 'CARDED_DAMAGED'
                        ? t('propose.example_damage', 'e.g. Yellowed bubble, creased edge')
                        : t('propose.example_condition', 'e.g. Unpunched card, pristine backing card')
                    }
                    className="w-full max-w-full min-w-0 truncate px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Barcode & Image Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-amber-500" />
                {t('propose.barcode', 'Codi de Barres (UPC / EAN)')}
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder={t('propose.example_barcode', 'e.g. 076281382101 or 5010993...')}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs font-mono"
              />
            </div>

            {/* Multiple Photos Upload or URL */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('propose.photo', 'Fotos de la Figura')} ({images.length})</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors flex items-center gap-1 cursor-pointer shadow-xs">
                    <UploadCloud className="w-3 h-3 text-amber-500" />
                    <span>Pujar fotos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultipleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>URL</span>
                  </button>
                </div>
              </div>

              {/* URL Input Form */}
              {showUrlInput && (
                <div className="flex gap-2 pt-1 animate-fadeIn">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://... (enllaç d'imatge)"
                    className="flex-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-900 dark:text-slate-100"
                  />
                  <CbButton size="sm" variant="amber" type="button" onClick={handleAddImageUrl}>
                    Afegir
                  </CbButton>
                </div>
              )}

              {/* Thumbnails preview with prominent cover selector */}
              {images.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-400">
                  Cap imatge afegida. Pots pujar una o més fotos (frontal, blíster, dors, accessoris...).
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
                    <span className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                      <span><strong>Foto de portada:</strong> Toca qualsevol foto o el botó daurat per triar quina és la imatge principal.</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {images.map((imgSrc, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if (idx !== 0) handleSetPrimaryImage(idx);
                        }}
                        className={`relative group shrink-0 w-24 h-24 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          idx === 0
                            ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-md scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-700 hover:border-amber-400/60 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={imgSrc}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />

                        {/* Primary badge or Make Primary Button */}
                        {idx === 0 ? (
                          <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>PORTADA</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimaryImage(idx);
                            }}
                            title="Establir com a foto de portada"
                            className="absolute bottom-1 inset-x-1 py-1 rounded bg-slate-900/90 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-[9px] font-bold flex items-center justify-center gap-1 transition-all shadow-md cursor-pointer border border-amber-500/40"
                          >
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>Fer portada</span>
                          </button>
                        )}

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveImage(idx);
                          }}
                          title="Eliminar foto"
                          className="absolute top-1 right-1 p-1 rounded-full bg-slate-950/80 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description & Collector Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              {t('propose.description', 'Descripció, Variants o Accessoris Originals')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('propose.example_description', 'e.g. Brown vinyl cape, yellow telescoping saber, small blaster...')}
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 dark:focus:border-amber-400 transition-all shadow-xs resize-none"
            />
          </div>

          </div>

          {/* Modal Footer Actions */}
          <div className="flex-shrink-0 p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <CbButton
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              {t('propose.cancel', 'Cancel·lar')}
            </CbButton>

            <CbButton
              variant="primary"
              size="sm"
              type="submit"
              disabled={submitting}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              {submitting ? t('propose.submitting', 'Enregistrant...') : t('propose.submit', 'Proposar i Publicar Figura')}
            </CbButton>
          </div>
        </form>
      </div>
    </div>
  );
};
