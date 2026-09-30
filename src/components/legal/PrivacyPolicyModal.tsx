import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  FileText, 
  Cookie, 
  Check, 
  X, 
  AlertCircle,
  ExternalLink,
  Download,
  Info
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms' | 'cookies';
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy'
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'cookies'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-6 transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="legal-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {t('legal.title', 'Marc Legal, Privadesa i RGPD')}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                  {t('legal.eu_compliant', 'RGPD / UE 2016/679')}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('legal.subtitle', 'Informació sobre el tractament de dades, condicions d\'ús i protecció de privadesa')}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={t('common.close', 'Tancar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 px-4 pt-2 gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'privacy'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-sm'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('legal.tab_privacy', 'Política de Privacitat (RGPD)')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'terms'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-sm'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t('legal.tab_terms', 'Termes d\'Ús i Avís Legal')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cookies')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
              activeTab === 'cookies'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-sm'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            {t('legal.tab_cookies', 'Cookies i Emmagatzematge')}
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm text-slate-700 dark:text-slate-300 flex-1 leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Cardback respecta escrupolosament el Reglament General de Protecció de Dades (RGPD / Reglament UE 2016/679) i la Llei Orgànica de Protecció de Dades Personals i garantia dels drets digitals (LOPDGDD). No comercialitzem, venem ni compartim les teves dades personals amb cap tercer amb finalitats publicitàries.
                </p>
              </div>

              {/* 1. Responsable del tractament */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold">1</span>
                  Responsable del Tractament
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-7">
                  L'aplicació Cardback (desenvolupada com a eina especialitzada per a col·leccionistes d'action figures) actua com a responsable del tractament de les dades d'usuari registrades a la plataforma. Per a qualsevol qüestió o sol·licitud relacionada amb la privadesa, pots contactar a través del suport oficial de l'aplicació.
                </p>
              </div>

              {/* 2. Dades recopilades */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold">2</span>
                  Quines dades recollim i amb quina finalitat?
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 pl-7 space-y-1.5 list-disc list-outside">
                  <li><strong>Dades d'identificació i accés:</strong> Nom d'usuari, correu electrònic i contrasenya (emmagatzemada amb xifratge irreversible mitjançant hash segur bcrypt amb 12 rondes de salt). Finalitat: Gestió d'accés, autenticació segura i recuperació de contrasenyes per email.</li>
                  <li><strong>Dades de la teva col·lecció:</strong> Figures catalogades, variants seleccionades, estat de conservació (MOC/Loose/Graded), valor estimat i notes personals. Finalitat: Oferir-te el servei d'inventari personalitzat.</li>
                  <li><strong>Imatges i fotos de figures:</strong> Fotografies d'articles o codis de barres pujades per tu voluntàriament per a la identificació amb IA (Google Gemini Vision). Finalitat única: Proporcionar la comparativa amb el catàleg i motlles històrics.</li>
                </ul>
              </div>

              {/* 3. Base Jurídica */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold">3</span>
                  Base Jurídica del Tractament
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-7">
                  La base legal per al tractament és l'<strong>execució de la relació de servei</strong> (Art. 6.1.b RGPD) en crear el teu compte de col·leccionista, i el <strong>consentiment explícit</strong> (Art. 6.1.a RGPD) atorgat mitjançant el diàleg de conformitat de connexió abans de sincronitzar dades i connectar amb els models d'IA.
                </p>
              </div>

              {/* 4. Drets de l'usuari (ARCO-POL) */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold">4</span>
                  Els teus drets sota el RGPD (Dret a l'Oblit i Portabilitat)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-7 mb-2">
                  Com a usuari a la Unió Europea, tens garantits els següents drets en qualsevol moment:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7 text-xs">
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Dret d'Accés i Portabilitat:</span>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">Pots descarregar en qualsevol moment tota la teva col·lecció en fitxer JSON o full CSV des de la secció del teu Perfil.</p>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Dret de Rectificació i Supressió:</span>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">Pots editar les teves dades o sol·licitar la cancel·lació i eliminació definitiva del teu compte i inventari.</p>
                  </div>
                </div>
              </div>

              {/* 5. Seguretat tècnica */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold">5</span>
                  Mesures de Seguretat Implementades
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 pl-7 space-y-1 list-disc list-outside">
                  <li>Connexions xifrades punt a punt amb <strong>TLS 1.3 / HTTPS</strong>.</li>
                  <li>Capçaleres de seguretat HTTP (Helmet) per protegir contra atacs XSS, clickjacking i sniffing de MIME.</li>
                  <li>Limitadors de trànsit (<strong>Rate Limiting</strong>) en els formularis d'accés i recuperació de contrasenyes per blindar el servei davant d'atacs de força bruta.</li>
                  <li>Cookies de sessió amb marcadors <code>HttpOnly</code>, <code>SameSite</code> i protecció contra atacs CSRF.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-1">
                  Avís Legal i Marques Registrades (Disclaimer)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Cardback és una aplicació independent creada per i per a col·leccionistes amb finalitats culturals, de recerca i de gestió d'inventari personal.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
                <p>
                  <strong>Propietat intel·lectual de tercers:</strong> Tots els noms de productes, marques comercials, logotips, motlles, noms de personatges i imatges de blísters o cardbacks (inclosos Kenner, Hasbro, Lucasfilm Ltd., Disney, Mattel, Playmates, McFarlane Toys, etc.) són marques registrades dels seus respectius titulars legítims.
                </p>
                <p>
                  Aquesta aplicació no està patrocinada, avalada, afiliada ni autoritzada de cap manera per aquests titulars de marques. La utilització d'aquestes denominacions i referències històriques es fa sota els principis d'ús legítim («fair use») i amb caràcter purament descriptiu i informatiu per al reconeixement de figures de col·leccionisme.
                </p>
                <p>
                  <strong>Ús del servei:</strong> L'usuari es compromet a utilitzar la plataforma d'acord amb la legislació vigent, sense carregar continguts que vulnerin drets de tercers ni intentar vulnerar la seguretat o els servidors de la plataforma.
                </p>
                <p>
                  <strong>Valoracions de mercat:</strong> Les estimacions de preu (Loose i MOC) es basen en dades històriques i guies de mercat per a col·leccionistes, i tenen caràcter purament orientatiu. No constitueixen una taxació oficial garantida.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1.5 flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-amber-500" />
                  Política de Cookies i Emmagatzematge Tècnic
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  A Cardback tenim una política estricta de privadesa: <strong>no utilitzem cookies publicitàries, ni píxels de seguiment ni cookies de perfil comercial de tercers.</strong>
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-2.5">Identificador</th>
                      <th className="p-2.5">Tipus</th>
                      <th className="p-2.5">Caducitat</th>
                      <th className="p-2.5">Finalitat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">cb_session</td>
                      <td className="p-2.5">Cookie tècnica (HttpOnly, Secure)</td>
                      <td className="p-2.5">Sessió o 30 dies</td>
                      <td className="p-2.5">Mantenir la sessió del teu compte de col·leccionista de forma segura.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">cb_theme_mode</td>
                      <td className="p-2.5">localStorage</td>
                      <td className="p-2.5">Persistent</td>
                      <td className="p-2.5">Recordar la teva preferència de tema visual (Clar / Fosc).</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">cb_language</td>
                      <td className="p-2.5">localStorage</td>
                      <td className="p-2.5">Persistent</td>
                      <td className="p-2.5">Desar la teva selecció d'idioma preferit.</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-[11px] text-amber-600 dark:text-amber-400 font-bold">cb_connection_consent</td>
                      <td className="p-2.5">localStorage / sessionStorage</td>
                      <td className="p-2.5">Persistent o Sessió</td>
                      <td className="p-2.5">Guardar el consentiment legal de transferència de dades per a serveis al núvol.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pots esborrar o bloquejar aquestes cookies i l'emmagatzematge local a través de la configuració del teu navegador en qualsevol moment. Tingues en compte que la cookie tècnica <code>cb_session</code> és imprescindible perquè la sessió romangui iniciada.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Última revisió i conformitat: Setembre de 2026 • Versió 1.2
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 transition-colors shadow-sm"
          >
            {t('common.understood', 'Entès i d\'acord')}
          </button>
        </div>
      </div>
    </div>
  );
};
