import React, { useState, useEffect } from 'react';
import { FigureDetailResponseDto, EntityType, OwnedFigure } from '../../types/domain';
import { CbCard } from '../shared/CbCard';
import { Badge } from '../shared/Badge';
import { CbButton } from '../shared/CbButton';
import { handleImageError, getFigureImageUrl } from '../../utils/imageFallback';
import { CollectionService } from '../../services/collectionService';
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
  Star
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

  const [ownedState, setOwnedState] = useState<OwnedFigure | undefined>(() =>
    CollectionService.getAll().find(i => i.figureId === data.id)
  );

  const [preferredCoverPhoto, setPreferredCoverPhoto] = useState<string>(() => {
    const item = CollectionService.getAll().find(i => i.figureId === data.id);
    return item?.figureImageUrl || data.imageUrl;
  });

  const [coverNotification, setCoverNotification] = useState<string | null>(null);

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

  useEffect(() => {
    const item = CollectionService.getAll().find(i => i.figureId === data.id);
    setOwnedState(item);
    const cover = item?.figureImageUrl || data.imageUrl;
    setPreferredCoverPhoto(cover);
    setSelectedImage(cover);
  }, [data.id, data.imageUrl]);

  const handleSetCoverPhoto = () => {
    if (ownedState) {
      // Put selectedImage as figureImageUrl and first in images array
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
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
            </CbCard>

            {/* Gallery Thumbnails Strip & Cover Photo Selector */}
            {galleryImages.length > 1 && (
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
                </div>

                {/* Set as Cover Photo Button / Status Bar */}
                <div className="pt-0.5">
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

                  {coverNotification && (
                    <div className="mt-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 text-center animate-fadeIn flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>{coverNotification}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <CbButton
                variant={isFigureOwned ? 'secondary' : 'amber'}
                size="md"
                className="w-full font-bold"
                icon={<BookmarkPlus className="w-4 h-4" />}
                onClick={handleAddToCollection}
              >
                {isFigureOwned ? t('collection.in_collection', 'In your collection') : t('collection.add_btn', 'Add to collection')}
              </CbButton>
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
                {data.originalAccessories.map((acc, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {acc}
                  </span>
                ))}
              </div>
            </div>

            {/* Contextual Character Lore Callout */}
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
          {data.productReleases.map(rel => (
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
    </div>
  );
};
