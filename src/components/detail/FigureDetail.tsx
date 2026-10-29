import React, { useState, useEffect, useRef } from 'react';
import { FigureDetailResponseDto, EntityType, OwnedFigure } from '../../types/domain';
import { CbCard } from '../shared/CbCard';
import { Badge } from '../shared/Badge';
import { CbButton } from '../shared/CbButton';
import { handleImageError, getFigureImageUrl } from '../../utils/imageFallback';
import { CollectionService } from '../../services/collectionService';
import { compressImage } from '../../utils/imageCompressor';
import { AddFigureModal } from '../collection/AddFigureModal';
import { 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Package, 
  BookmarkPlus, 
  ArrowRight, 
  CheckCircle2, 
  Compass, 
  Tag, 
  Box,
  Images,
  Star,
  Edit3,
  ImagePlus,
  Trash2,
  Plus,
  Upload,
  Link as LinkIcon,
  Check,
  DollarSign,
  Calendar,
  MapPin,
  FileText,
  X,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface FigureDetailProps {
  data: FigureDetailResponseDto;
  onNavigate: (type: EntityType, id: string) => void;
  onAddToCollection: (figure: FigureDetailResponseDto, variantId?: string, releaseId?: string) => void;
  isOwned?: boolean;
}

export const FigureDetail: React.FC<FigureDetailProps> = ({
  data,
  onNavigate,
  onAddToCollection,
  isOwned = false
}) => {
  const { t } = useLanguage();

  // Find owned figure record if current user owns this figure
  const [ownedState, setOwnedState] = useState<OwnedFigure | undefined>(() =>
    CollectionService.getAll().find(i => i.figureId === data.id || i.id === data.id)
  );

  const [preferredCoverPhoto, setPreferredCoverPhoto] = useState<string>(() => {
    const item = CollectionService.getAll().find(i => i.figureId === data.id || i.id === data.id);
    return item?.figureImageUrl || data.imageUrl;
  });

  const [coverNotification, setCoverNotification] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to live collection changes
  useEffect(() => {
    const unsub = CollectionService.subscribe(items => {
      const found = items.find(i => i.figureId === data.id || i.id === data.id);
      setOwnedState(found);
      if (found?.figureImageUrl) {
        setPreferredCoverPhoto(found.figureImageUrl);
      }
    });
    return unsub;
  }, [data.id]);

  useEffect(() => {
    const item = CollectionService.getAll().find(i => i.figureId === data.id || i.id === data.id);
    setOwnedState(item);
    const cover = item?.figureImageUrl || data.imageUrl;
    setPreferredCoverPhoto(cover);
    setSelectedImage(cover);
  }, [data.id, data.imageUrl]);

  const isFigureOwned = Boolean(ownedState) || isOwned;
  const currentCoverPhoto = ownedState?.figureImageUrl || preferredCoverPhoto || data.imageUrl;

  // Aggregate all unique candidate images: main, explicit images array, releases, variants, and owned collection photos
  const candidateImages = [
    currentCoverPhoto,
    data.imageUrl,
    ...(Array.isArray(data.images) ? data.images : []),
    ...(Array.isArray(ownedState?.images) ? ownedState.images : []),
    ...(ownedState?.figureImageUrl ? [ownedState.figureImageUrl] : []),
    ...(data.productReleases?.map(r => r.imageUrl) || []),
    ...(data.variants?.map(v => v.imageUrl) || [])
  ].filter(Boolean) as string[];

  const galleryImages = Array.from(new Set(candidateImages));
  const [selectedImage, setSelectedImage] = useState<string>(currentCoverPhoto);

  const handleSetCoverPhoto = () => {
    if (ownedState) {
      const updatedImages = [
        selectedImage,
        ...galleryImages.filter(img => img !== selectedImage)
      ];
      const updated = CollectionService.updateFigure(ownedState.id, {
        figureImageUrl: selectedImage,
        images: updatedImages
      });
      if (updated) {
        setOwnedState(updated);
      }
    } else {
      setPreferredCoverPhoto(selectedImage);
    }
    setCoverNotification(t('collection.cover_updated', 'Foto de portada actualitzada!'));
    setTimeout(() => {
      setCoverNotification(null);
    }, 3500);
  };

  // Direct multi-photo file upload for owner
  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingPhoto(true);
    const newPhotos: string[] = [];

    for (const file of files) {
      try {
        const compressed = await compressImage(file, 850, 0.78);
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
            console.warn('Could not persist to storage endpoint, using compressed fallback:', uploadErr);
          }
          newPhotos.push(finalUrl);
        }
      } catch (err) {
        console.warn('Failed to compress image:', err);
      }
    }

    if (newPhotos.length > 0) {
      if (ownedState) {
        const currentList = Array.isArray(ownedState.images) ? ownedState.images : [];
        const updatedList = Array.from(new Set([...currentList, ...newPhotos]));
        const updated = CollectionService.updateFigure(ownedState.id, {
          images: updatedList
        });
        if (updated) {
          setOwnedState(updated);
        }
      }
      // Set the first newly added photo as preview
      setSelectedImage(newPhotos[0]);
      setSuccessToast(`S'han afegit ${newPhotos.length} foto(s) noves a la figura!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }

    setIsUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Add photo via direct URL
  const handleAddUrlPhoto = () => {
    const trimmed = newUrlInput.trim();
    if (!trimmed) return;

    if (ownedState) {
      const currentList = Array.isArray(ownedState.images) ? ownedState.images : [];
      if (!currentList.includes(trimmed)) {
        const updatedList = [...currentList, trimmed];
        const updated = CollectionService.updateFigure(ownedState.id, {
          images: updatedList
        });
        if (updated) {
          setOwnedState(updated);
        }
      }
    }

    setSelectedImage(trimmed);
    setNewUrlInput('');
    setShowUrlModal(false);
    setSuccessToast('Nova foto afegida per enllaç URL!');
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Remove photo from owned figure
  const handleDeletePhoto = (photoToDelete: string) => {
    if (!ownedState) return;
    const currentList = Array.isArray(ownedState.images) ? ownedState.images : [];
    const remaining = currentList.filter(img => img !== photoToDelete);
    
    let newCover = ownedState.figureImageUrl;
    if (ownedState.figureImageUrl === photoToDelete) {
      newCover = remaining[0] || data.imageUrl;
    }

    const updated = CollectionService.updateFigure(ownedState.id, {
      images: remaining,
      figureImageUrl: newCover
    });

    if (updated) {
      setOwnedState(updated);
    }

    if (selectedImage === photoToDelete) {
      setSelectedImage(newCover);
    }

    setSuccessToast('Foto eliminada de la figura');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleAddToCollection = () => {
    const figureToSave: FigureDetailResponseDto = {
      ...data,
      imageUrl: currentCoverPhoto,
      images: [
        currentCoverPhoto,
        ...galleryImages.filter(img => img !== currentCoverPhoto)
      ]
    };
    onAddToCollection(figureToSave);
  };

  // Save changes from Edit Modal
  const handleSaveEditModal = (updatedData: Omit<OwnedFigure, 'id' | 'addedAt'>) => {
    if (ownedState) {
      const updated = CollectionService.updateFigure(ownedState.id, updatedData);
      if (updated) {
        setOwnedState(updated);
        if (updated.figureImageUrl) {
          setPreferredCoverPhoto(updated.figureImageUrl);
          setSelectedImage(updated.figureImageUrl);
        }
      }
    }
    setIsEditModalOpen(false);
    setSuccessToast('Dades de la teva figura actualitzades correctament!');
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Value calculation for owner
  const purchasePrice = ownedState?.purchasePrice || 0;
  const estimatedValue = ownedState?.estimatedValue || 0;
  const valueDifference = estimatedValue - purchasePrice;
  const valueAppreciationPercent = purchasePrice > 0 
    ? Math.round((valueDifference / purchasePrice) * 100) 
    : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hidden file input for photo additions */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleDirectPhotoUpload}
      />

      {/* Global Success Notification Toast */}
      {successToast && (
        <div className="fixed top-20 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-semibold animate-fadeIn border border-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Banner & Visual Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Main Visual Image & Card Frame */}
          <div className="w-full lg:w-80 shrink-0 space-y-3">
            <CbCard cardbackStyle className="p-4 pt-7 aspect-3/4 bg-slate-950/5 dark:bg-slate-950 flex items-center justify-center relative overflow-hidden group">
              <img
                src={getFigureImageUrl(selectedImage)}
                alt={data.name}
                onError={handleImageError}
                className="w-full h-full object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
              />

              {/* Active Cover Badge on Main Card */}
              {selectedImage === currentCoverPhoto && (
                <div className="absolute top-2.5 left-2.5 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md z-10">
                  <Star className="w-3 h-3 fill-slate-950 text-slate-950" />
                  <span>{t('collection.cover_badge', 'Portada')}</span>
                </div>
              )}

              {/* Photo counter indicator (1 / N) */}
              {galleryImages.length > 1 && (
                <div className="absolute top-2.5 right-2.5 bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10 shadow-sm z-10">
                  <Images className="w-3 h-3 text-amber-400" />
                  <span>{galleryImages.indexOf(selectedImage) + 1} / {galleryImages.length}</span>
                </div>
              )}

              {/* Loading spinner during photo upload */}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-20">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                  <span className="text-xs font-semibold">Comprimint i pujant fotos...</span>
                </div>
              )}
            </CbCard>

            {/* Gallery Thumbnails Strip & Controls */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {galleryImages.map((imgUrl, i) => {
                  const isCurrentSelected = selectedImage === imgUrl;
                  const isCover = currentCoverPhoto === imgUrl;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedImage(imgUrl)}
                      title={isCover ? `${t('collection.cover_badge', 'Portada')} (#${i + 1})` : `Foto #${i + 1}`}
                      className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all p-0.5 bg-slate-950/5 dark:bg-slate-900 ${
                        isCurrentSelected
                          ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                          : 'border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={getFigureImageUrl(imgUrl)}
                        alt={`Miniatura ${i + 1}`}
                        onError={handleImageError}
                        className="w-full h-full object-cover rounded-md"
                      />
                      {isCover && (
                        <span
                          className="absolute top-1 right-1 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-sm"
                          title={t('collection.cover_badge', 'Portada')}
                        >
                          <Star className="w-2.5 h-2.5 fill-current" />
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Direct "Afegir Foto" button in thumbnail strip */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Afegir fotos des del dispositiu"
                  className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-amber-500/50 hover:border-amber-500 text-amber-600 dark:text-amber-400 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>+ Foto</span>
                </button>
              </div>

              {/* Set as Cover Photo Button / Status Bar */}
              <div className="pt-0.5 space-y-1.5">
                {selectedImage === currentCoverPhoto ? (
                  <div className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 rounded-lg font-medium">
                    <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                    <span>{t('collection.current_cover_photo', 'Aquesta és la foto de portada actual')}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSetCoverPhoto}
                    className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded-lg border border-amber-500/50 hover:border-amber-500 bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-semibold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('collection.set_as_cover', 'Definir com a foto de portada')}</span>
                  </button>
                )}

                {/* Delete photo button if owner uploaded multiple images and viewing non-original */}
                {isFigureOwned && ownedState?.images && ownedState.images.includes(selectedImage) && ownedState.images.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(selectedImage)}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] py-1 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Eliminar aquesta foto de la meva galeria</span>
                  </button>
                )}

                {coverNotification && (
                  <div className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 text-center animate-fadeIn flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>{coverNotification}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2 pt-1">
              {isFigureOwned ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{t('collection.in_collection', 'A la teva col·lecció (Propietari)')}</span>
                  </div>

                  <CbButton
                    variant="amber"
                    size="md"
                    className="w-full font-bold shadow-sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    Editar dades de la figura
                  </CbButton>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
                    >
                      <ImagePlus className="w-3.5 h-3.5 text-amber-500" />
                      <span>+ Fotos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUrlModal(true)}
                      className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-amber-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
                      title="Afegir foto per URL"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>URL</span>
                    </button>
                  </div>
                </div>
              ) : (
                <CbButton
                  variant="amber"
                  size="md"
                  className="w-full font-bold shadow-sm"
                  icon={<BookmarkPlus className="w-4 h-4" />}
                  onClick={handleAddToCollection}
                >
                  {t('collection.add_btn', 'Afegir a la col·lecció')}
                </CbButton>
              )}
            </div>
          </div>

          {/* Details Content */}
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('franchise', data.franchise.name.toLowerCase().replace(/\s+/g, '-'))}
                  className="hover:underline focus:outline-none"
                >
                  <Badge variant="franchise" size="sm">{data.franchise.name}</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('line', data.line.id)}
                  className="hover:underline focus:outline-none"
                >
                  <Badge variant="line" size="sm">{data.line.name}</Badge>
                </button>
                {data.code && (
                  <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
                    {data.code}
                  </span>
                )}
                <span className="text-xs text-slate-500 font-semibold">{data.year} Release</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-slate-100 font-display">
                {data.name}
              </h1>

              <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                {data.description}
              </p>
            </div>

            {/* OWNER'S EXCLUSIVE INVENTORY PANEL (Displayed if user owns this figure) */}
            {ownedState && (
              <div className="p-5 sm:p-6 rounded-2xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/40 dark:from-amber-950/30 dark:via-slate-900/60 dark:to-slate-950 space-y-4 shadow-sm animate-fadeIn">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shadow-md">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-display">
                          El teu registre a la col·lecció
                        </h3>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          Propietari
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Pots editar qualsevol dada (preu, comentaris, data, estat) i afegir més fotos a la teva fitxa.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <CbButton
                      variant="amber"
                      size="sm"
                      icon={<Edit3 className="w-3.5 h-3.5" />}
                      onClick={() => setIsEditModalOpen(true)}
                      className="font-bold shadow-sm flex-1 sm:flex-initial"
                    >
                      Editar dades
                    </CbButton>

                    <CbButton
                      variant="outline"
                      size="sm"
                      icon={<ImagePlus className="w-3.5 h-3.5 text-amber-500" />}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-amber-500/40 hover:border-amber-500 text-amber-700 dark:text-amber-300 flex-1 sm:flex-initial"
                    >
                      Afegir fotos
                    </CbButton>
                  </div>
                </div>

                {/* 4-Metric Appraisal & Specs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* Preu de compra */}
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 shadow-xs space-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">
                      Preu de compra
                    </span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 font-mono">
                      {purchasePrice > 0 ? `${purchasePrice} ${ownedState.currency || 'USD'}` : 'Sense cost'}
                    </span>
                  </div>

                  {/* Valor estimat actual */}
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 shadow-xs space-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">
                      Valor estimat
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {estimatedValue > 0 ? `${estimatedValue} ${ownedState.currency || 'USD'}` : 'No estimat'}
                      </span>
                      {purchasePrice > 0 && estimatedValue > 0 && (
                        <span className={`text-[10px] font-mono font-bold ${valueDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {valueDifference >= 0 ? `+${valueDifference}` : valueDifference}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Estat de conservació */}
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 shadow-xs space-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">
                      Estat de conservació
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block truncate">
                      {ownedState.condition} {ownedState.gradingScore ? `(${ownedState.gradingScore})` : ''}
                    </span>
                  </div>

                  {/* Data d'adquisició */}
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-500/20 shadow-xs space-y-0.5">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-medium">
                      Data d'adquisició
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                      {ownedState.acquisitionDate || 'No especificada'}
                    </span>
                  </div>
                </div>

                {/* Secondary Specs: Ubicació, Quantitat i Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="space-y-1 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      <span>Ubicació d'emmagatzematge:</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 pl-5">
                      {ownedState.storageLocation || 'Sense ubicació assignada'} ({ownedState.quantity || 1} unitat/s)
                    </p>
                  </div>

                  <div className="space-y-1 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <FileText className="w-3.5 h-3.5 text-amber-500" />
                      <span>Comentaris i notes del col·leccionista:</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 pl-5 italic">
                      {ownedState.collectorNotes ? `"${ownedState.collectorNotes}"` : 'Cap comentari afegit encara. Fes clic a "Editar dades" per registrar notes sobre l’estat, procedència o valor.'}
                    </p>
                  </div>
                </div>

                {/* Photos status */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-500/20 text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Images className="w-4 h-4 text-amber-500" />
                    <span>Tens <strong>{galleryImages.length} fotos</strong> associades a aquesta figura</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Afegir més fotografies</span>
                  </button>
                </div>
              </div>
            )}

            {/* Non-owner invitation callout */}
            {!isFigureOwned && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    No tens aquesta figura a la teva col·lecció
                  </span>
                  <p className="text-slate-500 dark:text-slate-400">
                    Afegeix-la per registrar el teu preu de compra personal, estat de conservació, notes i galeria de fotos.
                  </p>
                </div>
                <CbButton
                  variant="amber"
                  size="sm"
                  icon={<BookmarkPlus className="w-3.5 h-3.5" />}
                  onClick={handleAddToCollection}
                  className="shrink-0 font-bold"
                >
                  Afegir
                </CbButton>
              </div>
            )}

            {/* Sculpt Specs & Articulation */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs">
              <div>
                <span className="text-slate-500 block">{t('detail.manufacturer', 'Manufacturer')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{data.line.manufacturerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{t('detail.scale', 'Scale')}</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{data.line.scale || '3.75"'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{t('detail.articulation', 'Articulation')}</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                  {data.articulationPoints} POA (Points of Articulation)
                </span>
              </div>
            </div>

            {/* Accessories Checklist */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('detail.original_accessories', 'Original included accessories')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.originalAccessories && data.originalAccessories.length > 0 ? (
                  data.originalAccessories.map((acc, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {acc}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No hi ha accessoris específics registrats.</span>
                )}
              </div>
            </div>

            {/* Contextual Character Lore Callout */}
            {data.character && (
              <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 flex items-start gap-4">
                <img
                  src={getFigureImageUrl(data.character.imageUrl)}
                  alt={data.character.name}
                  onError={handleImageError}
                  className="w-14 h-14 rounded-full object-cover border-2 border-purple-500 shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold text-purple-600 dark:text-purple-400">
                      {t('detail.lore_context', 'Fictional background')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('character', data.character.id)}
                      className="text-xs font-semibold text-purple-700 dark:text-purple-300 hover:underline inline-flex items-center gap-1 focus:outline-none"
                    >
                      View {data.character.name} Character Page <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {data.character.description}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prominent Variants Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-500" />
              {t('detail.figure_variants', 'Catalogue variants and distinguishing features')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t('detail.variant_description', 'Catalogue entries describing molds, paint revisions, and rare variants')}
            </p>
          </div>
        </div>

        {data.variants && data.variants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {data.variants.map(v => (
              <CbCard
                key={v.id}
                interactive
                onClick={() => onNavigate('variant', v.id)}
                className="group p-5 hover:border-rose-500/60 flex gap-4 items-start"
              >
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                  <img
                    src={getFigureImageUrl(v.imageUrl)}
                    alt={v.name}
                    onError={handleImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="variant" size="sm">{t('detail.catalogue_variant', 'Variant')}</Badge>
                    {v.isRare && (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide bg-rose-500/10 px-2 py-0.5 rounded">
                        {t('detail.high_value', 'High collector value')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    {v.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong>{t('detail.differentiator', 'Distinguishing feature')}:</strong> {v.distinguishingFeature}
                  </p>
                  <div className="pt-2 flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform">
                    <span>{t('detail.variant_analysis', 'Variant analysis and identification')}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </CbCard>
            ))}
          </div>
        ) : (
          <CbCard className="p-8 text-center text-slate-500">
            {t('detail.no_variants', 'No major casting variants have been recorded for this release yet.')}
          </CbCard>
        )}
      </div>

      {/* Commercial Product Releases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-500" />
              {t('detail.packaging_releases', 'Commercial packaging releases')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {t('detail.packaging_description', 'Boxed, carded, regional, and retailer-exclusive packaging versions')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.productReleases && data.productReleases.map(rel => (
            <CbCard
              key={rel.id}
              interactive
              cardbackStyle
              onClick={() => onNavigate('product_release', rel.id)}
              className="group p-4 pt-7 hover:border-cyan-500/60 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <img
                    src={getFigureImageUrl(rel.imageUrl)}
                    alt={rel.name}
                    onError={handleImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div>
                  <Badge variant="product_release" size="sm">{rel.packagingType}</Badge>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {rel.name}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                    <span>{t('detail.region', 'Region')}: {rel.region}</span>
                    <span>{t('detail.year', 'Year')}: {rel.releaseYear}</span>
                  </div>
                  {rel.barcode && (
                    <span className="font-mono text-[10px] text-slate-400 block mt-1">
                      UPC: {rel.barcode}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-cyan-600 dark:text-cyan-400 font-semibold">
                <span>{t('detail.view_packaging', 'View packaging details')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </CbCard>
          ))}
        </div>
      </div>

      {/* Complete Owner Edit Form Modal */}
      {isEditModalOpen && (
        <AddFigureModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          figure={data}
          initialData={ownedState}
          onSave={handleSaveEditModal}
        />
      )}

      {/* Add Photo by URL Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-amber-500" /> Afegir fotografia per URL
              </h3>
              <button
                type="button"
                onClick={() => setShowUrlModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Enllaç directe de la imatge (HTTPS):
              </label>
              <input
                type="url"
                placeholder="https://exemple.cat/foto-figura.jpg"
                value={newUrlInput}
                onChange={e => setNewUrlInput(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <CbButton
                variant="outline"
                size="sm"
                onClick={() => setShowUrlModal(false)}
              >
                Cancel·lar
              </CbButton>
              <CbButton
                variant="amber"
                size="sm"
                onClick={handleAddUrlPhoto}
                disabled={!newUrlInput.trim()}
              >
                Afegir a la figura
              </CbButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
