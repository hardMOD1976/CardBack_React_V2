import React, { useState, useMemo } from 'react';
import { CollectionService } from '../../services/collectionService';
import { OwnedFigure, FigureCondition, EntityType } from '../../types/domain';
import { CbCard } from '../shared/CbCard';
import { Badge } from '../shared/Badge';
import { CbButton } from '../shared/CbButton';
import { handleImageError, getFigureImageUrl } from '../../utils/imageFallback';
import { 
  Bookmark, 
  DollarSign, 
  TrendingUp, 
  ShieldCheck, 
  ArrowUpDown, 
  SlidersHorizontal, 
  Plus, 
  Trash2, 
  Edit3, 
  ArrowRight,
  Sparkles,
  MapPin,
  Heart,
  Images
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface CollectionViewProps {
  onNavigate: (type: EntityType, id: string) => void;
  onOpenAddModal: () => void;
  onEditItem: (item: OwnedFigure) => void;
  isWishlistView?: boolean;
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  onNavigate,
  onOpenAddModal,
  onEditItem,
  isWishlistView = false
}) => {
  const { t, currentLanguage } = useLanguage();
  const [collection, setCollection] = useState<OwnedFigure[]>(() => {
    return isWishlistView
      ? CollectionService.getWishlist()
      : CollectionService.getOwnedFigures();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [franchiseFilter, setFranchiseFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'value' | 'price' | 'condition'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [figureToDelete, setFigureToDelete] = useState<OwnedFigure | null>(null);

  // Listen to collection changes
  React.useEffect(() => {
    const unsub = CollectionService.subscribe(() => {
      setCollection(
        isWishlistView
          ? CollectionService.getWishlist()
          : CollectionService.getOwnedFigures()
      );
    });
    return unsub;
  }, [isWishlistView]);

  const stats = useMemo(() => CollectionService.getCollectionStats(), [collection]);

  // Unique franchises in collection
  const availableFranchises = useMemo(() => {
    const set = new Set(collection.map(c => c.franchiseName));
    return Array.from(set);
  }, [collection]);

  // Filter & Sort
  const filteredItems = useMemo(() => {
    return collection
      .filter(item => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.figureName.toLowerCase().includes(q);
          const matchLine = item.lineName.toLowerCase().includes(q);
          const matchVar = item.variantName?.toLowerCase().includes(q);
          const matchCode = item.figureCode?.toLowerCase().includes(q);
          if (!matchName && !matchLine && !matchVar && !matchCode) return false;
        }
        if (conditionFilter !== 'all' && item.condition !== conditionFilter) {
          return false;
        }
        if (franchiseFilter !== 'all' && item.franchiseName !== franchiseFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'date') {
          comp = new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
        } else if (sortBy === 'name') {
          comp = a.figureName.localeCompare(b.figureName);
        } else if (sortBy === 'value') {
          comp = (b.estimatedValue || 0) - (a.estimatedValue || 0);
        } else if (sortBy === 'price') {
          comp = (b.purchasePrice || 0) - (a.purchasePrice || 0);
        } else if (sortBy === 'condition') {
          comp = a.condition.localeCompare(b.condition);
        }
        return sortOrder === 'asc' ? comp : -comp;
      });
  }, [collection, searchQuery, conditionFilter, franchiseFilter, sortBy, sortOrder]);

  const handleDeleteClick = (e: React.MouseEvent, item: OwnedFigure) => {
    e.stopPropagation();
    setFigureToDelete(item);
  };

  const handleConfirmDelete = () => {
    if (!figureToDelete) return;
    const id = figureToDelete.id;
    setFigureToDelete(null);
    CollectionService.removeFigure(id);
  };

  const handleCancelDelete = () => {
    setFigureToDelete(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs uppercase font-mono tracking-wider text-slate-500 font-semibold">
              {isWishlistView ? t('nav.wishlist', 'Wishlist') : t('collection.title', 'Col·lecció')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 font-display">
            {isWishlistView ? t('collection.wishlist_title', 'Target Wishlist') : t('collection.title', 'My Figure Collection')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isWishlistView
              ? t('collection.wishlist_subtitle', 'Catalogued figures and variants you plan to acquire.')
              : t('collection.subtitle', 'Manage your owned figures, condition records, and valuations.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CbButton
            variant="amber"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={onOpenAddModal}
          >
            {t('collection.add_btn', 'Add Figure to Collection')}
          </CbButton>
        </div>
      </div>

      {/* Portfolio Stats Dashboard (for main collection) */}
      {!isWishlistView && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-500" /> {t('dashboard.stats_figures', 'Owned figures')}
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-display">
              {stats.totalFigures} <span className="text-xs text-slate-400 font-normal font-sans">{t('common.units', 'units')}</span>
            </div>
            <span className="text-[11px] text-slate-400">
              {t('dashboard.unique_catalogue', '{{count}} unique catalogue molds').replace('{{count}}', String(stats.uniqueFiguresCount))}
            </span>
          </CbCard>

          <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> {t('dashboard.stats_value', 'Portfolio value')}
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display font-mono">
              ${stats.totalEstimatedValue.toLocaleString(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400">
              {t('collection.verified_appraisal', 'Verified market appraisal')}
            </span>
          </CbCard>

          <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-blue-500" /> {t('collection.acquisition_cost', 'Total acquisition cost')}
            </span>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-200 font-display font-mono">
              ${stats.totalInvested.toLocaleString(currentLanguage, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-slate-400">
              {t('collection.capital_expended', 'Capital expended')}
            </span>
          </CbCard>

          <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-1 bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-500/20">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> {t('dashboard.stats_growth', 'Capital growth (ROI)')}
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-display font-mono">
              +${stats.unrealizedGain.toLocaleString(currentLanguage, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span className="text-xs font-bold ml-1.5 bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-300">
                +{stats.gainPercentage}%
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('collection.appreciation', 'Appreciation over purchase')}
            </span>
          </CbCard>
        </div>
      )}

      {/* Filter and Sorting Controls - Responsive grid layout preventing horizontal overflow on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 w-full overflow-hidden">
        {/* Condition Filter */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
            {t('propose.condition', 'Condition')}:
          </label>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs truncate"
          >
            <option value="all">{t('collection.all_conditions', 'All conditions')}</option>
            <option value="MOC">{t('propose.cond_moc', 'Mint on Card (MOC)')}</option>
            <option value="LOOSE_COMPLETE">{t('propose.cond_loose_comp', 'Loose complete')}</option>
            <option value="LOOSE_INCOMPLETE">{t('propose.cond_loose_incomp', 'Loose incomplete')}</option>
            <option value="GRADED">{t('propose.cond_opt_graded', 'Professionally graded')}</option>
          </select>
        </div>

        {/* Franchise Filter */}
        <div className="space-y-1 min-w-0">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
            {t('nav.franchises', 'Franchise')}:
          </label>
          <select
            value={franchiseFilter}
            onChange={(e) => setFranchiseFilter(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs truncate"
          >
            <option value="all">{t('databank.all_franchises', 'All franchises')}</option>
            {availableFranchises.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        {/* Sorting Controls */}
        <div className="space-y-1 min-w-0 sm:col-span-2 md:col-span-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
            {t('databank.sort_by', 'Sort by')}:
          </label>
          <div className="flex items-center gap-1.5 w-full">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 min-w-0 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs truncate"
            >
              <option value="date">{t('collection.date_added', 'Date added')}</option>
              <option value="name">{t('collection.figure_name', 'Figure name')}</option>
              <option value="value">{t('collection.estimated_value', 'Estimated value')}</option>
              <option value="price">{t('collection.purchase_price', 'Purchase price')}</option>
              <option value="condition">{t('propose.condition', 'Condition')}</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 shrink-0 cursor-pointer shadow-2xs"
              title={t('collection.sort_order', 'Sort {{order}}').replace('{{order}}', sortOrder === 'asc' ? t('collection.ascending', 'ascending') : t('collection.descending', 'descending'))}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Collection Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map(item => (
            <CbCard
              key={item.id}
              cardbackStyle
              interactive
              onClick={() => onNavigate('figure', item.figureId)}
              className="group p-4 pt-7 hover:border-amber-500/60 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Figure Image */}
                <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative">
                  <img
                    src={getFigureImageUrl(item.figureImageUrl)}
                    alt={item.figureName}
                    onError={handleImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 max-w-[75%]">
                    <Badge variant={item.condition === 'GRADED' ? 'purple' : item.condition === 'MOC' ? 'amber' : 'gray'} size="sm">
                      <span className="truncate max-w-full block">
                        {item.condition === 'MOC' 
                          ? 'MOC' 
                          : item.condition === 'GRADED' 
                          ? (item.gradingScore ? `Graded: ${item.gradingScore}` : 'Graded') 
                          : item.condition === 'LOOSE_COMPLETE' 
                          ? 'Loose Complet' 
                          : item.condition === 'LOOSE_INCOMPLETE' 
                          ? 'Loose Incompl.' 
                          : item.condition}
                      </span>
                    </Badge>
                  </div>
                  {item.quantity > 1 && (
                    <div className="absolute top-2 right-2 bg-slate-900/90 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded">
                      x{item.quantity}
                    </div>
                  )}
                  {item.images && item.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs border border-white/10">
                      <Images className="w-3 h-3 text-amber-400" />
                      <span>{item.images.length}</span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-0.5">
                    {item.lineName}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                    {item.figureName}
                  </h3>

                  {item.variantName && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
                      {t('collection.variant_label', 'Variant')}: {item.variantName}
                    </div>
                  )}

                  {item.storageLocation && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{item.storageLocation}</span>
                    </div>
                  )}
                </div>

                {/* Financial Appraisal Row */}
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{t('dashboard.cost', 'Cost')}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">${item.purchasePrice}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">{t('dashboard.stats_value', 'Current value')}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">${item.estimatedValue}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
                  {t('collection.catalogue_detail', 'Catalogue detail')} <ArrowRight className="w-3 h-3" />
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditItem(item);
                    }}
                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    title={t('collection.edit_details', 'Edit inventory details')}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(e, item)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                    title={t('collection.remove_item', 'Remove from collection')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </CbCard>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
          <Bookmark className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isWishlistView ? t('collection.empty_wishlist_title', 'Your wishlist is empty') : t('collection.empty_collection_title', 'No figures found in your collection')}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isWishlistView
              ? t('collection.empty_wishlist_help', 'Browse the catalogue and bookmark figures you want to own.')
              : t('collection.empty_collection_help', 'Add your first figure to record its condition, value, and storage location.')}
          </p>
          <div className="pt-2">
            <CbButton variant="amber" size="sm" onClick={onOpenAddModal} icon={<Plus className="w-3.5 h-3.5" />}>
              {t('collection.add_now', 'Add a figure now')}
            </CbButton>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {figureToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn"
          onClick={handleCancelDelete}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-scaleIn text-left relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            {/* Header Icon & Question */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 id="delete-confirm-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {t('collection.delete_confirm_title', '¿Segur que voleu eliminar aquesta figura de la vostra col·lecció?')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('collection.delete_confirm_subtitle', 'Aquesta acció traurà el registre de la figura del teu inventari de manera permanent.')}
                </p>
              </div>
            </div>

            {/* Target Figure Preview Card */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <img
                src={getFigureImageUrl(figureToDelete.figureImageUrl)}
                alt={figureToDelete.figureName}
                onError={handleImageError}
                className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-900"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-400 block truncate">{figureToDelete.lineName}</span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{figureToDelete.figureName}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {figureToDelete.condition}
                  </span>
                  {figureToDelete.estimatedValue > 0 && (
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ${figureToDelete.estimatedValue}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons: Cancel·lar and D'acord */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {t('common.cancel', 'Cancel·lar')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('common.confirm_ok', "D'acord")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
