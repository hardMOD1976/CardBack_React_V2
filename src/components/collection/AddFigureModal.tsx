import React, { useState, useEffect } from 'react';
import { FigureDetailResponseDto, FigureCondition, OwnedFigure } from '../../types/domain';
import { CbInput } from '../shared/CbInput';
import { CbButton } from '../shared/CbButton';
import { Badge } from '../shared/Badge';
import { handleImageError, getFigureImageUrl } from '../../utils/imageFallback';
import { X, BookmarkPlus, DollarSign, Calendar, MapPin, FileText, Check, Tag, Film, Sparkles, ShieldCheck, ImagePlus, Trash2, Star, Upload, Plus } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const COMMON_FRANCHISES = [
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

const COMMON_MANUFACTURERS = [
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
  'Altre fabricant'
];

interface AddFigureModalProps {
  figure: FigureDetailResponseDto | null;
  selectedVariantId?: string;
  selectedReleaseId?: string;
  initialData?: OwnedFigure | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<OwnedFigure, 'id' | 'addedAt'>) => void;
}

export const AddFigureModal: React.FC<AddFigureModalProps> = ({
  figure,
  selectedVariantId,
  selectedReleaseId,
  initialData,
  isOpen,
  onClose,
  onSave
}) => {
  const { t } = useLanguage();
  const [figureName, setFigureName] = useState(initialData?.figureName || figure?.name || '');
  const [lineName, setLineName] = useState(initialData?.lineName || figure?.line?.name || '');
  const [franchiseName, setFranchiseName] = useState(
    initialData?.franchiseName || figure?.franchise?.name || 'Star Wars'
  );
  const [manufacturerName, setManufacturerName] = useState(
    initialData?.manufacturerName || (figure as any)?.line?.manufacturerName || 'Hasbro'
  );
  const [condition, setCondition] = useState<FigureCondition>(initialData?.condition || 'MOC');
  const [gradingScore, setGradingScore] = useState(initialData?.gradingScore || '');
  const [purchasePrice, setPurchasePrice] = useState<number>(initialData?.purchasePrice || 0);
  const [estimatedValue, setEstimatedValue] = useState<number>(initialData?.estimatedValue || 50);
  const [currency, setCurrency] = useState(initialData?.currency || 'USD');
  const [acquisitionDate, setAcquisitionDate] = useState(
    initialData?.acquisitionDate || new Date().toISOString().split('T')[0]
  );
  const [quantity, setQuantity] = useState<number>(initialData?.quantity || 1);
  const [storageLocation, setStorageLocation] = useState(initialData?.storageLocation || 'Main Display Shelf');
  const [collectorNotes, setCollectorNotes] = useState(initialData?.collectorNotes || '');
  const [isWishlist, setIsWishlist] = useState<boolean>(initialData?.isWishlist || false);
  const [variantId, setVariantId] = useState<string>(selectedVariantId || initialData?.variantId || '');
  const [releaseId, setReleaseId] = useState<string>(selectedReleaseId || initialData?.productReleaseId || '');

  // Multiple images state
  const initialImages: string[] = initialData?.images && initialData.images.length > 0
    ? initialData.images
    : (initialData?.figureImageUrl ? [initialData.figureImageUrl] : (figure?.imageUrl ? [figure.imageUrl] : []));
  const [images, setImages] = useState<string[]>(initialImages);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFigureName(initialData?.figureName || figure?.name || '');
    setLineName(initialData?.lineName || figure?.line?.name || '');
    setFranchiseName(initialData?.franchiseName || figure?.franchise?.name || 'Star Wars');
    setManufacturerName(initialData?.manufacturerName || (figure as any)?.line?.manufacturerName || 'Hasbro');
    setCondition(initialData?.condition || 'MOC');
    setGradingScore(initialData?.gradingScore || '');
    setPurchasePrice(initialData?.purchasePrice || 0);
    setEstimatedValue(initialData?.estimatedValue || 50);
    setCurrency(initialData?.currency || 'USD');
    setAcquisitionDate(initialData?.acquisitionDate || new Date().toISOString().split('T')[0]);
    setQuantity(initialData?.quantity || 1);
    setStorageLocation(initialData?.storageLocation || 'Main Display Shelf');
    setCollectorNotes(initialData?.collectorNotes || '');
    setIsWishlist(initialData?.isWishlist || false);
    setVariantId(selectedVariantId || initialData?.variantId || '');
    setReleaseId(selectedReleaseId || initialData?.productReleaseId || '');

    const resolvedImgs: string[] = initialData?.images && initialData.images.length > 0
      ? initialData.images
      : (initialData?.figureImageUrl ? [initialData.figureImageUrl] : (figure?.imageUrl ? [figure.imageUrl] : []));
    setImages(resolvedImgs);
    setUrlInput('');
    setShowUrlInput(false);
  }, [isOpen, initialData, selectedVariantId, selectedReleaseId, figure?.id]);

  const handleMultipleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const resultStr = reader.result;
          setImages(prev => prev.includes(resultStr) ? prev : [...prev, resultStr]);
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset file input
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
      const rest = prev.filter((_, idx) => idx !== indexToPromote);
      return [target, ...rest];
    });
  };

  if (!isOpen || (!figure && !initialData)) return null;

  const fig = figure || {
    id: initialData?.figureId || '',
    name: initialData?.figureName || '',
    code: initialData?.figureCode,
    imageUrl: initialData?.figureImageUrl || '',
    line: { id: initialData?.lineId || '', name: initialData?.lineName || '' },
    franchise: { name: initialData?.franchiseName || '' },
    variants: [],
    productReleases: []
  };

  const activeVariant = fig.variants?.find(v => v.id === variantId);
  const activeRelease = fig.productReleases?.find(r => r.id === releaseId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedFranchise = franchiseName.trim() || fig.franchise.name || 'General';
    const resolvedManufacturer = manufacturerName.trim() || (fig as any).line?.manufacturerName || 'Hasbro';
    const resolvedFigureName = figureName.trim() || fig.name || 'Figura d’acció';
    const resolvedLineName = lineName.trim() || fig.line.name || 'Línia General';

    const primaryImg = images[0] || fig.imageUrl || '/cardback_placeholder.jpeg';
    const allImgs = images.length > 0 ? images : [primaryImg];

    let currentUserId = 'anonymous';
    try {
      const uStr = localStorage.getItem('cb_user');
      if (uStr) currentUserId = JSON.parse(uStr)?.id || 'anonymous';
    } catch {}

    onSave({
      userId: initialData?.userId || currentUserId,
      figureId: fig.id || `custom-fig-${Date.now()}`,
      figureName: resolvedFigureName,
      figureCode: fig.code,
      figureImageUrl: primaryImg,
      images: allImgs,
      lineId: fig.line?.id || 'custom-line',
      lineName: resolvedLineName,
      franchiseId: resolvedFranchise.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      franchiseName: resolvedFranchise,
      manufacturerName: resolvedManufacturer,
      variantId: variantId || undefined,
      variantName: activeVariant?.name || initialData?.variantName,
      productReleaseId: releaseId || undefined,
      releasePackaging: activeRelease?.packagingType || initialData?.releasePackaging,
      condition,
      gradingScore: condition === 'GRADED' ? gradingScore : undefined,
      purchasePrice: Number(purchasePrice) || 0,
      currency,
      estimatedValue: Number(estimatedValue) || 0,
      acquisitionDate,
      quantity: Number(quantity) || 1,
      storageLocation,
      collectorNotes,
      isWishlist
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {initialData ? t('collection.edit_record', 'Edit collection record') : t('collection.add_btn', 'Add to collection')}
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {figureName || fig.name} • {franchiseName || fig.franchise.name}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Target Figure Banner */}
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <img
                src={getFigureImageUrl(fig.imageUrl)}
                alt={fig.name}
                onError={handleImageError}
                className="w-12 h-12 rounded-md object-cover border border-slate-300 dark:border-slate-600 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={figureName}
                  onChange={(e) => setFigureName(e.target.value)}
                  placeholder={t('propose.name', 'Nom de la figura')}
                  className="w-full text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-amber-500 pb-0.5 truncate"
                />
                <input
                  type="text"
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  placeholder={t('propose.line', 'Línia')}
                  className="w-full text-[11px] text-slate-500 bg-transparent border-b border-dashed border-transparent focus:border-slate-400 focus:outline-none pt-0.5 truncate"
                />
              </div>
            </div>

            {/* Multiple Images Manager */}
            <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{t('collection.images_gallery', 'Fotografies de la figura')} ({images.length})</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer border border-amber-500/30">
                    <Upload className="w-3 h-3" />
                    <span>Pujar fotos</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultipleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
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

              {/* Thumbnails list */}
              {images.length === 0 ? (
                <div className="text-center py-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-400">
                  Cap imatge afegida. Puja una o més fotos (frontal, blíster, dors, estat).
                </div>
              ) : (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  {images.map((imgSrc, idx) => (
                    <div
                      key={idx}
                      className={`relative group shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === 0
                          ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                          : 'border-slate-200 dark:border-slate-700 opacity-90 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getFigureImageUrl(imgSrc)}
                        alt={`Figura ${idx + 1}`}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                      {/* Primary badge */}
                      {idx === 0 ? (
                        <div className="absolute top-1 left-1 bg-amber-500 text-slate-950 font-bold text-[9px] px-1 rounded flex items-center gap-0.5 shadow-xs">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>Portada</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(idx)}
                          title="Establir com a imatge de portada"
                          className="absolute top-1 left-1 p-1 rounded bg-slate-900/80 text-slate-200 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        title="Eliminar aquesta imatge"
                        className="absolute top-1 right-1 p-1 rounded bg-rose-600/90 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Franchise & Manufacturer Fields (Franquícia & Fabricant) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{t('nav.franchises', 'Franquícia')} *</span>
                </label>
                <input
                  list="addmodal-franchises"
                  type="text"
                  value={franchiseName}
                  onChange={(e) => setFranchiseName(e.target.value)}
                  placeholder="ex. Star Wars, MOTU, Marvel..."
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs truncate"
                />
                <datalist id="addmodal-franchises">
                  {COMMON_FRANCHISES.map(f => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 truncate">
                  <Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{t('databank.manufacturer', 'Fabricant')} *</span>
                </label>
                <input
                  list="addmodal-manufacturers"
                  type="text"
                  value={manufacturerName}
                  onChange={(e) => setManufacturerName(e.target.value)}
                  placeholder="ex. Hasbro, Kenner, Mattel..."
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs truncate"
                />
                <datalist id="addmodal-manufacturers">
                  {COMMON_MANUFACTURERS.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Condition / Estat Selector (Guaranteed zero-overflow) */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 w-full max-w-full overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{t('propose.condition', 'Estat de Conservació')}</span>
                </label>
                <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold truncate">
                  {condition}
                </span>
              </div>

              {/* Compact segmented buttons with short non-overflowing labels */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                {[
                  { id: 'MOC' as const, label: 'MOC', desc: 'Blíster intacte' },
                  { id: 'LOOSE_COMPLETE' as const, label: 'Loose Compl.', desc: '100% peces' },
                  { id: 'LOOSE_INCOMPLETE' as const, label: 'Loose Incompl.', desc: 'Falten peces' },
                  { id: 'GRADED' as const, label: 'Graduada', desc: 'AFA / CAS' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCondition(opt.id)}
                    className={`w-full min-w-0 px-2 py-2 rounded-lg text-center border transition-all cursor-pointer overflow-hidden ${
                      condition === opt.id
                        ? 'border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-300 ring-1 ring-amber-500 font-bold'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="block text-xs font-bold truncate leading-tight">{opt.label}</span>
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-none">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Standardized dropdown that prevents any long-label blowout */}
              <div className="w-full min-w-0 pt-0.5">
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as FigureCondition)}
                  className="w-full max-w-full min-w-0 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs truncate"
                >
                  <option value="MOC">{t('propose.cond_opt_moc', 'Mint on Card (MOC - Blíster original segellat)')}</option>
                  <option value="LOOSE_COMPLETE">{t('propose.cond_opt_loose_comp', 'Loose Complet (Amb tots els accessoris originals)')}</option>
                  <option value="LOOSE_INCOMPLETE">{t('propose.cond_opt_loose_incomp', 'Loose Incomplet (Falta algun accessori o arma)')}</option>
                  <option value="GRADED">{t('propose.cond_opt_graded', 'Graduada Professionalment (AFA / CAS / UKG / PSA)')}</option>
                  <option value="CUSTOM">{t('propose.cond_opt_custom', 'Customitzada / Restaurada')}</option>
                </select>
              </div>
            </div>

            {/* Grading Score if Graded */}
            {condition === 'GRADED' && (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {t('collection.grading_certificate', 'Grading certificate and score (e.g. AFA 85, UKG 80, CAS 85+)')}
                </label>
                <CbInput
                  value={gradingScore}
                  onChange={setGradingScore}
                  placeholder={t('collection.grading_placeholder', 'AFA 85 (NM+)')}
                  size="sm"
                />
              </div>
            )}

            {/* Associated Variant Selection */}
            {fig.variants && fig.variants.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {t('collection.variant_specification', 'Catalogued variant')}
                </label>
                <select
                  value={variantId}
                  onChange={(e) => setVariantId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">{t('collection.standard_variant', 'Standard / general casting')}</option>
                  {fig.variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.distinguishingFeature})
                    </option>
                  ))}
                </select>
              </div>
            )}

          {/* Financials & Acquisition Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> {t('collection.purchase_price', 'Preu de compra')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> {t('collection.estimated_value', 'Valor estimat')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> {t('collection.acquisition_date', 'Data d\'adquisició')}
              </label>
              <input
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {/* Storage Location & Quantity */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {t('collection.storage_location', 'Storage / display location')}
              </label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder={t('collection.storage_placeholder', 'Display shelf 1, acrylic case A...')}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {t('collection.quantity', 'Quantity')}
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100 text-center font-mono font-semibold"
              />
            </div>
          </div>

          {/* Wishlist toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t('collection.wishlist_toggle', 'Wishlist item')}
              </span>
              <span className="text-[11px] text-slate-500">
                {t('collection.wishlist_help', 'Track as an item you do not own yet')}
              </span>
            </div>
            <input
              type="checkbox"
              checked={isWishlist}
              onChange={(e) => setIsWishlist(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
          </div>

          {/* Collector Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> {t('collection.notes_provenance', 'Collector notes and provenance')}
            </label>
            <textarea
              rows={2}
              value={collectorNotes}
              onChange={(e) => setCollectorNotes(e.target.value)}
              placeholder={t('collection.notes_placeholder', 'Flawless bubble, unpunched card, bought from the original owner...')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-xs text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/70 dark:bg-slate-950/60">
          <CbButton variant="outline" size="sm" type="button" onClick={onClose}>
            {t('propose.cancel', 'Cancel')}
          </CbButton>
          <CbButton variant="amber" size="sm" type="submit" icon={<Check className="w-4 h-4" />}>
            {t('collection.save_record', 'Save to collection')}
          </CbButton>
        </div>
      </form>
      </div>
    </div>
  );
};
