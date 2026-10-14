import React, { useState, useEffect } from 'react';
import { CollectionService } from '../../services/collectionService';
import { ApiService } from '../../services/apiService';
import { CbCard } from '../shared/CbCard';
import { Badge } from '../shared/Badge';
import { CbButton } from '../shared/CbButton';
import { 
  User, 
  ShieldCheck, 
  Download, 
  MapPin, 
  Settings, 
  LogOut, 
  Layers, 
  Award, 
  DollarSign, 
  Check, 
  Bookmark,
  Sparkles,
  Database,
  Wifi,
  Sun,
  Moon,
  Palette,
  GitBranch,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../shell/LanguageSelector';
import { useTheme, SkinType } from '../../contexts/ThemeContext';
import { APP_VERSION } from '../../config/version';
import { VersionModal } from '../shared/VersionModal';

interface ProfileViewProps {
  currentUser: { name: string; email: string; id?: string; displayName?: string; role?: string } | null;
  onLogin: (user: { name: string; email: string }) => void;
  onLogout: () => void;
  onOpenAuthModal: () => void;
  onOpenConsentModal?: () => void;
  onOpenPrivacyModal?: () => void;
  isConsentAgreed?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onOpenAuthModal,
  onOpenConsentModal,
  onOpenPrivacyModal,
  isConsentAgreed = true
}) => {
  const { t } = useLanguage();
  const { skin, setSkin, mode, setMode } = useTheme();
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const stats = CollectionService.getCollectionStats();
  const ownedFigures = CollectionService.getOwnedFigures();
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ message: string; figuresCount?: number; linesCount?: number } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [dbStorageInfo, setDbStorageInfo] = useState<{ size: string; raw: number; counts?: Record<string, number> } | null>(null);
  const [isOptimizingDb, setIsOptimizingDb] = useState(false);
  const [optimizeSuccess, setOptimizeSuccess] = useState<string | null>(null);

  const loadDbStats = async () => {
    try {
      const res = await fetch('/api/db/stats');
      if (res.ok) {
        const data = await res.json();
        if (data.databaseSize) {
          setDbStorageInfo({ size: data.databaseSize, raw: data.rawDatabaseSize, counts: data.counts });
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadDbStats();
  }, []);

  const handleOptimizeDatabase = async () => {
    setIsOptimizingDb(true);
    setOptimizeSuccess(null);
    setSeedError(null);
    try {
      const res = await fetch('/api/db/optimize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Optimization failed');
      setOptimizeSuccess(t('seed.optimize_success', 'Base de dades Neon optimitzada i compactada correctament!'));
      await loadDbStats();
    } catch (err: any) {
      setSeedError(err.message || 'Error optimitzant Neon');
    } finally {
      setIsOptimizingDb(false);
    }
  };
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault(); setPasswordMessage(null); setPasswordError(null);
    if (newPassword.length < 12) { setPasswordError(t('auth.password_min', 'Use at least 12 characters for your password.')); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError(t('auth.password_mismatch', 'Passwords do not match.')); return; }
    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/password/change', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not change password.');
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordMessage(t('auth.password_changed', 'Password changed successfully.'));
    } catch (error: any) { setPasswordError(error.message || 'Could not change password.'); }
    finally { setIsChangingPassword(false); }
  };

  const handleSeedStarWarsDatabase = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    setSeedError(null);
    try {
      const res = await fetch('/api/db/seed/star-wars', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('cb_token') || ''}` } });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(t('seed.error', 'Could not load the catalogue into the database.'));
      }
      setSeedResult(data);
      // Synchronize in-memory catalogue with freshly seeded figures
      await ApiService.syncCatalogueWithServer();
    } catch (err: any) {
      setSeedError(err.message || t('seed.error', 'Could not load the catalogue into the database.'));
    } finally {
      setIsSeeding(false);
    }
  };

  // Storage locations breakdown
  const storageLocations = [
    { name: 'Main Display Cabinet A', type: 'glass', count: ownedFigures.filter(f => f.storageLocation?.includes('Case') || f.storageLocation?.includes('Display')).length || 2 },
    { name: 'Acrylic Armor UV Cases', type: 'uv', count: ownedFigures.filter(f => f.condition === 'MOC' || f.condition === 'GRADED').length || 2 },
    { name: 'Climate Vault Bin 01', type: 'acid_free', count: ownedFigures.filter(f => f.condition?.includes('LOOSE')).length || 1 }
  ];

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(ownedFigures, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cardback-collection-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleExportCsv = () => {
    const headers = [t('export.figure_name', 'Figure name'), t('export.line', 'Line'), t('export.franchise', 'Franchise'), t('export.condition', 'Condition'), t('export.purchase_price', 'Purchase price'), t('export.estimated_value', 'Estimated value'), t('export.storage', 'Storage location'), t('export.acquisition_date', 'Acquisition date')];
    const rows = ownedFigures.map(f => [
      `"${f.figureName}"`,
      `"${f.lineName}"`,
      `"${f.franchiseName}"`,
      `"${f.condition}"`,
      f.purchasePrice,
      f.estimatedValue,
      `"${f.storageLocation || 'Unassigned'}"`,
      `"${f.acquisitionDate}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cardback-collection-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      {/* Profile Header */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 font-display font-black text-2xl flex items-center justify-center shadow-md">
              {currentUser ? currentUser.name.slice(0, 2).toUpperCase() : 'CB'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-display">
                  {currentUser ? currentUser.name : t('profile.guest', 'Guest collector')}
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                  <Award className="w-3 h-3" /> {t('profile.master_archivist', 'Master archivist')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {currentUser ? currentUser.email : t('profile.local_session', 'Local device session active')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <CbButton
                variant="outline"
                size="sm"
                icon={<LogOut className="w-4 h-4" />}
                onClick={onLogout}
              >
                {t('auth.sign_out', 'Sign out')}
              </CbButton>
            ) : (
              <CbButton
                variant="amber"
                size="sm"
                icon={<User className="w-4 h-4" />}
                onClick={onOpenAuthModal}
              >
                {t('nav.sign_in', 'Sign in')}
              </CbButton>
            )}
          </div>
        </div>

        {/* Portfolio Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400">{t('dashboard.stats_figures', 'Total figures')}</span>
            <p className="text-lg font-black font-display text-slate-900 dark:text-slate-100">
              {stats.totalFigures}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400">{t('dashboard.stats_value', 'Portfolio value')}</span>
            <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
              ${stats.totalEstimatedValue}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400">{t('dashboard.invested', 'Total invested')}</span>
            <p className="text-lg font-black font-mono text-slate-700 dark:text-slate-300">
              ${stats.totalInvested}
            </p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-400">{t('dashboard.stats_growth', 'Archival gain (ROI)')}</span>
            <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
              +{stats.gainPercentage}%
            </p>
          </div>
        </div>
      </CbCard>

      {/* Control de Versions & Guia de Testeig */}
      <CbCard id="profile-version-card" className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Control de Versions & Estat de Desplegament
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono font-bold text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {APP_VERSION.version}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Compilació: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{APP_VERSION.buildDate}</span> • {APP_VERSION.environment}
              </p>
            </div>
          </div>

          <CbButton
            variant="outline"
            size="sm"
            onClick={() => setIsVersionModalOpen(true)}
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
          >
            Veure Changelog Complet
          </CbButton>
        </div>

        {/* Release Headline */}
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {APP_VERSION.releaseTitle}
          </p>
        </div>

        {/* Testable features list */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Què pots testejar en aquesta versió ({APP_VERSION.version}):
            </span>
            <span className="text-[11px] text-slate-400 font-mono">{APP_VERSION.testableFeatures.length} funcionalitats</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {APP_VERSION.testableFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-950 shadow-xs space-y-2 overflow-hidden"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {feat.status === 'updated' ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold font-mono border border-amber-500/40 shrink-0">
                        ACTUALITZAT
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold font-mono border border-emerald-500/40 shrink-0">
                        DISPONIBLE
                      </span>
                    )}
                    <h3 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-white leading-snug break-words">
                      {feat.title}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                  {feat.description}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {feat.tags.map((tg, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono font-medium"
                    >
                      #{tg}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CbCard>

      {currentUser && <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div><h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t('auth.change_password', 'Change password')}</h2><p className="mt-1 text-xs text-slate-500">{t('auth.password_min', 'Use at least 12 characters for your password.')}</p></div>
        {passwordMessage && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{passwordMessage}</p>}
        {passwordError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{passwordError}</p>}
        <form onSubmit={handlePasswordChange} className="grid gap-3 sm:grid-cols-2">
          <div className="relative flex items-center">
            <input
              required
              type={showCurrentPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder={t('auth.current_password', 'Current password')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm dark:bg-slate-950 dark:border-slate-700"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              aria-label={showCurrentPassword ? t('auth.hide_password', 'Amagar contrasenya') : t('auth.show_password', 'Mostrar contrasenya')}
              title={showCurrentPassword ? t('auth.hide_password', 'Amagar contrasenya') : t('auth.show_password', 'Mostrar contrasenya')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer rounded-lg"
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative flex items-center">
            <input
              required
              type={showNewPassword ? 'text' : 'password'}
              minLength={12}
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('auth.new_password', 'New password')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm dark:bg-slate-950 dark:border-slate-700"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              aria-label={showNewPassword ? t('auth.hide_password', 'Amagar contrasenya') : t('auth.show_password', 'Mostrar contrasenya')}
              title={showNewPassword ? t('auth.hide_password', 'Amagar contrasenya') : t('auth.show_password', 'Mostrar contrasenya')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer rounded-lg"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative flex items-center sm:col-span-2">
            <input
              required
              type={showConfirmNewPassword ? 'text' : 'password'}
              minLength={12}
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              placeholder={t('auth.confirm_password', 'Confirm password')}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-sm dark:bg-slate-950 dark:border-slate-700"
            />
            <button
              type="button"
              onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
              aria-label={showConfirmNewPassword ? t('auth.hide_password', 'Amagar contrasenya') : t('auth.show_password', 'Mostrar contrasenya')}
              title={showConfirmNewPassword ? t('auth.hide_password', 'Amagar contrasenya') : t('auth.show_password', 'Mostrar contrasenya')}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer rounded-lg"
            >
              {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div><CbButton variant="outline" size="sm" type="submit" disabled={isChangingPassword}>{isChangingPassword ? t('common.loading', 'Saving...') : t('auth.change_password', 'Change password')}</CbButton></div>
        </form>
      </CbCard>}

      {/* Database Connection Status Card */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('profile.database_connection', 'PostgreSQL database connection')}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('profile.connected_neon', 'Connected to Neon')}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {t('profile.database_description', 'The app is connected to your Neon PostgreSQL database with persistent storage.')}
        </p>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">{t('profile.provider', 'Provider')}:</span>
            <span className="text-slate-800 dark:text-slate-200 font-semibold">Neon Serverless PostgreSQL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('detail.region', 'Region')}:</span>
            <span className="text-slate-800 dark:text-slate-200">AWS eu-central-1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('profile.host', 'Host')}:</span>
            <span className="text-slate-800 dark:text-slate-200 truncate max-w-[280px]">ep-square-dew-as6xqopr-pooler.c-4.eu-central-1.aws.neon.tech</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('profile.database_name', 'Database name')}:</span>
            <span className="text-slate-800 dark:text-slate-200 font-bold">neondb</span>
          </div>
        </div>
      </CbCard>

      {/* Internet Connection Compliance & Legal Consent */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('consent.title', 'Connection consent and legal notice')}
            </h2>
          </div>
          <Badge variant={isConsentAgreed ? 'emerald' : 'amber'} className="text-xs">
            {isConsentAgreed ? t('profile.connection_authorized', 'Connection authorized') : t('profile.consent_pending', 'Consent pending')}
          </Badge>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {t('profile.consent_description', 'Manage permission for catalogue services, AI image processing, and barcode scanning. You can review or change your choice at any time.')}
        </p>

        <div className="pt-1 flex flex-wrap items-center gap-2">
          {onOpenConsentModal && (
            <CbButton
              variant="outline"
              size="sm"
              icon={<ShieldCheck className="w-4 h-4 text-amber-500" />}
              onClick={onOpenConsentModal}
            >
              {t('profile.review_terms', 'Review connection terms')}
            </CbButton>
          )}
          {onOpenPrivacyModal && (
            <CbButton
              variant="secondary"
              size="sm"
              icon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
              onClick={onOpenPrivacyModal}
            >
              {t('legal.title_short', 'Privadesa & RGPD (UE)')}
            </CbButton>
          )}
        </div>
      </CbCard>

      {/* Language & Regional Settings */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4 relative z-30 overflow-visible">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('common.language', 'Language')} / {t('profile.regional_settings', 'Regional settings')}
            </h2>
          </div>
          <LanguageSelector compact={false} />
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {t('profile.language_description', 'Choose your preferred language. Your choice is saved in this browser.')}
        </p>
      </CbCard>

      {/* Appearance, Theme & Skin Customization Card */}
      <CbCard id="profile-theme-card" className="p-6 border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('profile.appearance_theme', 'Aparença i Tema')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('profile.appearance_subtitle', 'Configura el mode clar/fosc i l’estil vintage de Cardback')}
              </p>
            </div>
          </div>
          <Badge variant={mode === 'dark' ? 'amber' : 'gray'} className="text-xs font-mono">
            {mode === 'dark' ? t('common.theme_dark', 'Mode Fosc') : t('common.theme_light', 'Mode Clar')}
          </Badge>
        </div>

        {/* 1. Light / Dark Theme Mode Selector Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block">
            {t('profile.theme_mode_label', 'Tema de color (Mode Clar / Fosc)')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              id="theme-light-btn"
              onClick={() => setMode('light')}
              aria-pressed={mode === 'light'}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                mode === 'light'
                  ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100 ring-2 ring-amber-500/40 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${mode === 'light' ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  <Sun className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block text-slate-900 dark:text-slate-100">
                    {t('common.theme_light', 'Mode Clar')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Fons lluminós i alt contrast de lectura
                  </span>
                </div>
              </div>
              {mode === 'light' && (
                <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>

            <button
              type="button"
              id="theme-dark-btn"
              onClick={() => setMode('dark')}
              aria-pressed={mode === 'dark'}
              className={`p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                mode === 'dark'
                  ? 'border-amber-500 bg-amber-500/10 text-slate-900 dark:text-slate-100 ring-2 ring-amber-500/40 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${mode === 'dark' ? 'bg-amber-500 text-slate-950 shadow-xs font-bold' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                  <Moon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold block text-slate-900 dark:text-slate-100">
                    {t('common.theme_dark', 'Mode Fosc')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Fons profund de col·leccionista
                  </span>
                </div>
              </div>
              {mode === 'dark' && (
                <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* 2. Visual Skin Selector (Vintage Kenner 78 / Modern / Neon 84) */}
        <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono block">
              {t('profile.skin_style_label', 'Estil i Skin d’Arxiu')}
            </label>
            <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
              {skin === 'vintage-kenner' ? "★ Kenner '78" : skin === 'retro-neon' ? "◆ Neon '84" : "● Modern"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Vintage Kenner Cardback */}
            <button
              type="button"
              onClick={() => setSkin('vintage-kenner')}
              aria-pressed={skin === 'vintage-kenner'}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                skin === 'vintage-kenner'
                  ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-amber-400">★</span> Kenner ’78
                </span>
                {skin === 'vintage-kenner' && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                Doble línia racetrack platejada clàssica i blau profund 1978.
              </p>
            </button>

            {/* Modern Archive */}
            <button
              type="button"
              onClick={() => setSkin('modern')}
              aria-pressed={skin === 'modern'}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                skin === 'modern'
                  ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-amber-500">●</span> Modern Archive
                </span>
                {skin === 'modern' && <Check className="w-3.5 h-3.5 text-amber-500" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                Disseny minimalista hipernet i de màxima precisió d'arxiu.
              </p>
            </button>

            {/* Neon 84 Synthwave */}
            <button
              type="button"
              onClick={() => setSkin('retro-neon')}
              aria-pressed={skin === 'retro-neon'}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                skin === 'retro-neon'
                  ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-cyan-400">◆</span> Neon ’84
                </span>
                {skin === 'retro-neon' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                Cian elèctric i quadrícula synthwave dels anys 80.
              </p>
            </button>
          </div>
        </div>
      </CbCard>

      {/* Star Wars Historical Catalogue Neon Seed Card */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('seed.title', 'Sincronització del Catàleg Star Wars a Neon')}
              </h2>
              <p className="text-xs text-slate-500">
                {t('seed.subtitle', 'PostgreSQL Neon Tech (Frankfurt eu-central-1)')}
              </p>
            </div>
          </div>
          <Badge variant="amber" className="text-xs">
            {t('seed.badge', '1977 - 2026 Archive')}
          </Badge>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {t('seed.description', 'Load the historical Star Wars figure catalogue into your Neon PostgreSQL database: 96 classic Kenner figures (1977–1985), later vintage and modern product lines.')}
        </p>

        {/* Live Storage Meter & Neon Explanation */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-amber-500" />
              {t('seed.storage_meter', 'Estat d\'Emmagatzematge a Neon DB:')}
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {dbStorageInfo ? `${dbStorageInfo.size} / 500 MB (~${Math.max(1, Math.round((dbStorageInfo.raw / (500 * 1024 * 1024)) * 100))}%)` : '~14 MB / 500 MB (~3%)'}
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(3, Math.round(((dbStorageInfo?.raw || 14 * 1024 * 1024) / (500 * 1024 * 1024)) * 100)))}%` }}
            />
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-0.5 space-y-1">
            <div>
              <span className="font-semibold text-slate-600 dark:text-slate-300">💡 {t('seed.info_title', 'Arquitectura estil Discogs activada:')}</span>{' '}
              {t('seed.info_detail', 'Totes les fotos es guarden com a fitxers independents (/uploads/) o enllaços d\'imatge externa. PostgreSQL només emmagatzema la URL de text (~40 bytes), mantenint el trànsit de la base de dades sota mínims.')}
            </div>
            <div className="flex items-center gap-1.5 pt-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Magatzem actiu: Fitxers Estàtics (/uploads/) — Zero imatges Base64 a Neon</span>
            </div>
          </div>
        </div>

        {optimizeSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs">
            <Check className="w-4 h-4 shrink-0" />
            <span>{optimizeSuccess}</span>
          </div>
        )}

        {seedResult && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs">
            <Check className="w-4 h-4 shrink-0" />
            <span>
              {t('seed.success', 'Catalogue loaded successfully')} ({seedResult.figuresCount} {t('databank.tab_figures', 'figures')}, {seedResult.linesCount} {t('databank.tab_lines', 'lines')}).
            </span>
          </div>
        )}

        {seedError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
            {seedError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <CbButton
            variant="primary"
            size="sm"
            disabled={isSeeding}
            onClick={handleSeedStarWarsDatabase}
            icon={<Database className="w-4 h-4" />}
          >
            {isSeeding ? t('seed.loading', 'Injectant a Neon DB...') : t('seed.btn', 'Carregar Catàleg Històric a Neon DB')}
          </CbButton>

          <CbButton
            variant="outline"
            size="sm"
            disabled={isOptimizingDb}
            onClick={handleOptimizeDatabase}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isOptimizingDb ? 'animate-spin' : ''}`} />}
          >
            {isOptimizingDb ? t('seed.optimizing', 'Optimitzant...') : t('seed.optimize_btn', 'Optimitzar i compactar imatges a Neon')}
          </CbButton>

          <span className="text-[11px] text-slate-400">
            {t('seed.quota_note', '* Només ocupa ~4 MB (~1% del teu límit gratuït de 500 MB a Neon).')}
          </span>
        </div>
      </CbCard>

      {/* Storage Locations */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('profile.storage_locations', 'Physical storage locations')}
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {t('profile.locations_configured', '{{count}} locations configured').replace('{{count}}', String(storageLocations.length))}
          </span>
        </div>

        <div className="space-y-2.5">
          {storageLocations.map((loc, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {loc.name}
                </span>
                <p className="text-[11px] text-slate-500">
                  {t('profile.container_type', 'Container type')}: {t(`profile.storage_type_${loc.type}`, loc.type)}
                </p>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                {loc.count} {t('nav.figures', 'Figures')}
              </span>
            </div>
          ))}
        </div>
      </CbCard>

      {/* Data Export & Backup */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('profile.export_title', 'Collection backup and export')}
            </h2>
          </div>
          {downloadSuccess && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> {t('profile.export_downloaded', 'Export downloaded')}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {t('profile.export_description', 'Export your figure catalogue records, valuation history, and condition notes.')}
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <CbButton
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportJson}
          >
            {t('profile.export_json', 'Export JSON archive')}
          </CbButton>

          <CbButton
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            {t('profile.export_csv', 'Export CSV spreadsheet')}
          </CbButton>
        </div>
      </CbCard>

      {/* Demo Collector Persona Switcher */}
      <CbCard className="p-6 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('profile.demo_personas', 'Demo collector profiles')}
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          {t('profile.demo_description', 'Switch collector profiles to preview different collections:')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onLogin({ name: 'KennerArchivePro', email: 'vintage.kenner@cardback.io' })}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-amber-500 transition-colors"
          >
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              {t('profile.kenner_specialist', 'Vintage Kenner specialist')}
            </span>
            <span className="text-[11px] text-slate-500">
              vintage.kenner@cardback.io
            </span>
          </button>

          <button
            type="button"
            onClick={() => onLogin({ name: 'MOTUArchivist', email: 'eternia.vault@cardback.io' })}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left hover:border-amber-500 transition-colors"
          >
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              {t('profile.motu_archivist', 'MOTU and Hasbro archivist')}
            </span>
            <span className="text-[11px] text-slate-500">
              eternia.vault@cardback.io
            </span>
          </button>
        </div>
      </CbCard>

      {/* Full Version & Changelog Modal */}
      <VersionModal 
        isOpen={isVersionModalOpen} 
        onClose={() => setIsVersionModalOpen(false)} 
      />
    </div>
  );
};
