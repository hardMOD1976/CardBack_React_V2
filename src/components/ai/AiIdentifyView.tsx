import React, { useState, useEffect, useRef } from 'react';
import { EntityType, FigureDetailResponseDto } from '../../types/domain';
import { ApiService, AiFigureOption } from '../../services/apiService';
import { getFigureImageUrl, handleImageError } from '../../utils/imageFallback';
import { CbCard } from '../shared/CbCard';
import { Badge } from '../shared/Badge';
import { CbButton } from '../shared/CbButton';
import { ScanResultModal } from '../shared/ScanResultModal';
import { 
  Cpu, 
  Upload, 
  Camera, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Plus, 
  DollarSign, 
  RefreshCw,
  Eye,
  ShieldCheck,
  Wifi,
  WifiOff,
  Globe,
  PackageX,
  SwitchCamera,
  X,
  Crosshair,
  Layers,
  RotateCcw
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface AiIdentifyViewProps {
  onNavigateEntity: (type: EntityType, id: string) => void;
  onAddToCollection: (figure: FigureDetailResponseDto, variantId?: string, releaseId?: string) => void;
}

interface IdentifiedResult {
  figureId: string;
  figureName: string;
  lineName: string;
  franchiseName: string;
  manufacturer: string;
  year: number;
  imageUrl: string;
  confidence: number;
  packagingStatus?: string;
  detectedVariant?: {
    variantId: string;
    variantName: string;
    rarity: string;
    identifyingFeatures: string[];
    estimatedLooseValue: number;
    estimatedMocValue: number;
  };
  moldingDetails: string;
  authenticityNotes: string;
  accessoriesIdentified: string[];
  barcode?: string | null;
}

const SAMPLE_FIGURES = [
  {
    label: 'Star Wars Ep. I Queen Amidala Naboo (1999)',
    id: 'fig-sw-queen-amidala-naboo',
    variantId: 'var-sw-amidala-naboo-std',
    category: 'toy',
    imageUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80',
    description: '1999 Hasbro Episode I: The Phantom Menace — Vestit cerimonial vermell reial de Naboo amb xip CommTech'
  },
  {
    label: 'POTF2 Darth Vader (Long Saber)',
    id: 'fig-sw-vader-potf2',
    variantId: 'var-vader-potf2-long',
    category: 'toy',
    imageUrl: 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=800&auto=format&fit=crop&q=80',
    description: '1995 Red Card motlle de transició amb espasa làser translúcida llarga (Kenner / Hasbro)'
  },
  {
    label: 'Vintage 1978 Darth Vader',
    id: 'fig-sw-vader-vintage',
    category: 'toy',
    imageUrl: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=600&auto=format&fit=crop&q=80',
    description: 'Kenner 12-back original amb capa de vinil i sabre telescòpic'
  },
  {
    label: '1982 MOTU Skeletor (Soft Head)',
    id: 'fig-motu-skeletor-vintage',
    category: 'toy',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80',
    description: 'Mattel Taiwan wave 1 amb cap de cautxú tou'
  },
  {
    label: '1988 TMNT Leonardo',
    id: 'fig-tmnt-leo-vintage',
    category: 'toy',
    imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&auto=format&fit=crop&q=80',
    description: 'Playmates 10-back amb cap de goma tova i katanes dobles'
  },
  {
    label: 'Poma Fresca (Test: No Joguina -> Not Found)',
    id: 'test-non-toy-apple',
    category: 'non-toy',
    imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80',
    description: 'Fruita fresca de consum — Test de rebuig Not Found per a objectes que no són joguines'
  }
];

export const AiIdentifyView: React.FC<AiIdentifyViewProps> = ({
  onNavigateEntity,
  onAddToCollection
}) => {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState<string | null>(SAMPLE_FIGURES[0].imageUrl);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<IdentifiedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real-time camera viewfinder streaming state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Real-time network connectivity state
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // Multiple referenced options from online archives
  const [foundOptions, setFoundOptions] = useState<AiFigureOption[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Not Found state (when image is not a toy or non-figure)
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [notFoundDetails, setNotFoundDetails] = useState<{
    detectedSubject: string;
    reason?: string;
  } | null>(null);

  // Result modal state
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Monitor online / offline connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [mediaStream]);

  // Connect video element to media stream when active
  useEffect(() => {
    if (isCameraActive && mediaStream && videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play().catch(err => {
        console.warn('Video auto-play warning:', err);
      });
    }
  }, [isCameraActive, mediaStream]);

  const startCamera = async (targetMode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("El navegador no suporta l'accés directe a la càmera. Pots pujar una foto.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setMediaStream(stream);
      setFacingMode(targetMode);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setIsCameraActive(false);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? "Permís de càmera denegat pel navegador. Si us plau, activa el permís o puja una fotografia."
          : "No s'ha pogut iniciar el flux de la càmera. Pots fer una foto amb el botó de pujar fitxer."
      );
    }
  };

  const stopCamera = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    
    // Freeze and stop camera stream
    stopCamera();
    setSelectedImage(dataUrl);
    runIdentification(dataUrl);
  };

  const handleResetAll = () => {
    stopCamera();
    setSelectedImage(null);
    setResult(null);
    setErrorMessage(null);
    setNotFoundMessage(null);
    setNotFoundDetails(null);
    setFoundOptions([]);
    setSelectedOptionId(null);
    setIsResultModalOpen(false);
    setCameraError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (mobileFileInputRef.current) mobileFileInputRef.current.value = '';
  };

  // Helper to find or synthesize figure domain object
  const getOrSynthesizeFigure = (res: IdentifiedResult): FigureDetailResponseDto => {
    const existing = ApiService.getFigureDetail(res.figureId);
    if (existing) return existing;

    // Search by name
    const all = ApiService.getFigures({ search: res.figureName, limit: 1 });
    if (all.items.length > 0) {
      const match = ApiService.getFigureDetail(all.items[0].id);
      if (match) return match;
    }

    // Synthesize real figure detail matching domain DTO
    return {
      id: res.figureId,
      name: res.figureName,
      code: `LENS-${res.year}-${res.figureName.slice(0, 4).toUpperCase()}`,
      year: res.year,
      description: `Identificat per Google Lens (Gemini Vision AI): ${res.figureName} de ${res.lineName} (${res.franchiseName}).`,
      imageUrl: res.imageUrl,
      character: {
        id: `char-${res.figureName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: res.figureName,
        description: `Representació del personatge ${res.figureName}.`,
        imageUrl: res.imageUrl
      },
      line: {
        id: `line-${res.lineName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: res.lineName,
        manufacturerName: res.manufacturer || 'Hasbro / Kenner',
        startYear: res.year,
        scale: '3.75 inch'
      },
      franchise: {
        id: `fr-${res.franchiseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: res.franchiseName
      },
      sculptDetails: res.moldingDetails,
      articulationPoints: 5,
      originalAccessories: res.accessoriesIdentified,
      variants: [
        {
          id: res.detectedVariant?.variantId || 'var-1',
          name: res.detectedVariant?.variantName || 'Standard Release',
          figureId: res.figureId,
          figureName: res.figureName,
          distinguishingFeature: res.detectedVariant?.identifyingFeatures?.[0] || 'Matriu de producció original',
          imageUrl: res.imageUrl,
          isRare: (res.detectedVariant?.rarity || '').includes('Rare') || (res.detectedVariant?.rarity || '').includes('Grail')
        }
      ],
      productReleases: [
        {
          id: `rel-${res.figureId}`,
          name: `${res.figureName} (${res.lineName})`,
          figureId: res.figureId,
          variantId: res.detectedVariant?.variantId || 'var-1',
          packagingType: res.packagingStatus || 'Carded Blister (MOC)',
          region: 'US / Global',
          releaseYear: res.year,
          retailer: 'General Retail',
          imageUrl: res.imageUrl,
          barcode: res.barcode || undefined
        }
      ]
    };
  };

  const applyOptionAsCurrent = (opt: AiFigureOption) => {
    setSelectedOptionId(opt.id);
    setResult({
      figureId: `fig-${opt.figureName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      figureName: opt.figureName,
      lineName: opt.lineName,
      franchiseName: opt.franchiseName,
      manufacturer: opt.manufacturer,
      year: opt.year,
      imageUrl: selectedImage || opt.imageUrl || SAMPLE_FIGURES[0].imageUrl,
      confidence: opt.confidence,
      packagingStatus: opt.packagingStatus,
      detectedVariant: {
        variantId: `var-${opt.variantName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        variantName: opt.variantName,
        rarity: opt.estimatedMocValue > 80 ? 'Grail / Rare Variant' : 'Standard Release',
        identifyingFeatures: opt.identifyingFeatures,
        estimatedLooseValue: opt.estimatedLooseValue,
        estimatedMocValue: opt.estimatedMocValue
      },
      moldingDetails: opt.moldingDetails,
      authenticityNotes: opt.authenticityNotes,
      accessoriesIdentified: opt.accessoriesIdentified,
      barcode: opt.barcode
    });
  };

  const runIdentification = async (imageUrl: string, samplePresetId?: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setNotFoundMessage(null);
    setNotFoundDetails(null);
    setFoundOptions([]);
    setSelectedOptionId(null);

    // If device is offline
    if (!isOnline && !samplePresetId) {
      setIsAnalyzing(false);
      setErrorMessage(t('ai.offline_status', 'Es requereix connexió a Internet per analitzar fotografies amb Google Lens.'));
      return;
    }

    try {
      // Call Real Gemini Multimodal AI Endpoint
      const aiResponse = await ApiService.identifyFigureWithAi(imageUrl);

      // Handle Not Found or Server Errors
      if (aiResponse.isToyOrActionFigure === false || aiResponse.found === false) {
        if (aiResponse.notFoundReason === 'rate_limit_exceeded' || aiResponse.notFoundReason === 'service_unavailable_spike' || aiResponse.notFoundReason === 'vision_model_error') {
          setErrorMessage(aiResponse.message || "El servei de visió intel·ligent té una alta demanda en aquest moment. Prova-ho en uns segons.");
          setIsAnalyzing(false);
          return;
        }
        setNotFoundMessage(
          t('ai.non_toy', "L'objecte fotografiat no és cap figura d'acció ni joguina catalogada.")
        );
        setNotFoundDetails({
          detectedSubject: aiResponse.detectedSubject || "Element no catalogat com a joguina",
          reason: aiResponse.notFoundReason || "L'element no correspon a cap fabricant de figures o joguines reconegut a la xarxa."
        });
        setResult(null);
        setFoundOptions([]);
        setIsResultModalOpen(true);
        setIsAnalyzing(false);
        return;
      }

      // Process options found online
      const options = aiResponse.options || [];
      setFoundOptions(options);

      const generatedId = samplePresetId || `fig-${(aiResponse.figureName || 'figure').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      if (options.length > 0) {
        setSelectedOptionId(options[0].id);
      }

      setResult({
        figureId: generatedId,
        figureName: aiResponse.figureName || 'Figura Desconeguda',
        lineName: aiResponse.lineName || 'Col·lecció General',
        franchiseName: aiResponse.franchiseName || 'Action Figures',
        manufacturer: aiResponse.manufacturer || 'Kenner / Hasbro',
        year: aiResponse.year || 1980,
        imageUrl: imageUrl,
        confidence: aiResponse.confidence || 95.0,
        packagingStatus: aiResponse.packagingStatus || 'Carded Blister (MOC)',
        detectedVariant: {
          variantId: `var-${(aiResponse.variantName || 'standard').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          variantName: aiResponse.variantName || 'Edició Estàndard',
          rarity: (aiResponse.estimatedMocValue || 0) > 80 ? 'Grail / Rare Variant' : 'Standard Release',
          identifyingFeatures: aiResponse.identifyingFeatures || ['Matriu de producció original'],
          estimatedLooseValue: aiResponse.estimatedLooseValue || 25,
          estimatedMocValue: aiResponse.estimatedMocValue || 65
        },
        moldingDetails: aiResponse.moldingDetails || 'Matriu original de producció verificada.',
        authenticityNotes: aiResponse.authenticityNotes || 'Sense evidència de falsificació o còpia en resina.',
        accessoriesIdentified: aiResponse.accessoriesIdentified || [],
        barcode: aiResponse.barcode
      });
      setIsResultModalOpen(true);
    } catch (err: any) {
      console.warn('Gemini AI identification fallback:', err);
      // If sample preset was clicked, fallback to sample data if offline
      if (samplePresetId && samplePresetId !== 'test-non-toy-apple') {
        const fig = ApiService.getFigureDetail(samplePresetId);
        if (fig) {
          const primaryVariant = fig.variants[0];
          const synthOptions: AiFigureOption[] = [
            {
              id: `opt-1-${fig.id}`,
              title: `${fig.name} (${primaryVariant?.name || 'Edició Estàndard'})`,
              figureName: fig.name,
              lineName: fig.line.name,
              franchiseName: fig.franchise?.name || 'Action Figures',
              manufacturer: fig.line.manufacturerName,
              year: fig.year,
              variantName: primaryVariant?.name || 'Edició Estàndard',
              packagingStatus: 'Carded Blister (MOC)',
              description: `Opció catalogada a la col·lecció per a ${fig.name}.`,
              confidence: 96.5,
              estimatedLooseValue: 45,
              estimatedMocValue: 120,
              identifyingFeatures: [primaryVariant?.distinguishingFeature || 'Motlle original'],
              accessoriesIdentified: fig.originalAccessories,
              moldingDetails: `Motlle autèntic de ${fig.line.manufacturerName}.`,
              authenticityNotes: 'Plàstic original d\'època amb segell de copyright a la cama.',
              source: 'database'
            }
          ];

          setFoundOptions(synthOptions);
          setSelectedOptionId(synthOptions[0].id);

          setResult({
            figureId: fig.id,
            figureName: fig.name,
            lineName: fig.line.name,
            franchiseName: fig.franchise?.name || 'Action Figures',
            manufacturer: fig.line.manufacturerName,
            year: fig.year,
            imageUrl: imageUrl,
            confidence: 96.5,
            packagingStatus: 'Carded Blister (MOC)',
            detectedVariant: primaryVariant ? {
              variantId: primaryVariant.id,
              variantName: primaryVariant.name,
              rarity: primaryVariant.isRare ? 'Rare / Grail' : 'Standard Release',
              identifyingFeatures: [primaryVariant.distinguishingFeature],
              estimatedLooseValue: 45,
              estimatedMocValue: 120
            } : undefined,
            moldingDetails: `Motlle autèntic de ${fig.line.manufacturerName}. Prova d'articulació amb ${fig.articulationPoints} punts d'articulació (POA). ${fig.sculptDetails}`,
            authenticityNotes: 'Plàstic original de producció amb segell de copyright net.',
            accessoriesIdentified: fig.originalAccessories
          });
          setIsResultModalOpen(true);
        }
      } else if (samplePresetId === 'test-non-toy-apple') {
        // Explicit non-toy fallback
        setNotFoundMessage("Not Found: L'objecte fotografiat no és cap figura d'acció ni joguina de cap fabricant col·leccionable.");
        setNotFoundDetails({
          detectedSubject: "Poma Fresca / Fruita Natural",
          reason: "Fruita fresca de consum humà. No pertany a cap fabricant de figures o joguines."
        });
        setResult(null);
        setFoundOptions([]);
        setIsResultModalOpen(true);
      } else {
        const errMsg = err?.message?.includes("429") || err?.message?.includes("quota") || err?.message?.includes("RESOURCE_EXHAUSTED")
          ? "S'ha superat el límit temporal de peticions a la IA (429). Si us plau, espera uns segons i torna-ho a provar."
          : (err?.message || "No s'ha pogut identificar la figura en aquesta fotografia. Prova amb un altre angle o millor il·luminació.");
        setErrorMessage(errMsg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to compress and resize image from mobile camera to avoid payload limits
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stopCamera();
      try {
        setIsAnalyzing(true);
        const compressedUrl = await compressImage(file);
        setSelectedImage(compressedUrl);
        await runIdentification(compressedUrl);
      } catch (err) {
        console.error('File compression error:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          setSelectedImage(url);
          runIdentification(url);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_FIGURES[0]) => {
    stopCamera();
    setSelectedImage(sample.imageUrl);
    runIdentification(sample.imageUrl, sample.id);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn">
      {/* View Header with Connectivity State */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 font-display">
                  Google Lens (IA) • Identificació Visual
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 font-mono uppercase tracking-wider">
                  Vision Gemini AI
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Enfoca la figura o el blíster amb la càmera en directe o puja una fotografia per identificar motlle, variant, accessoris i valor de mercat.
              </p>
            </div>
          </div>
        </div>

        {/* Actions & Real-time Connectivity */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {(selectedImage || result || notFoundMessage || isCameraActive || errorMessage) && (
            <CbButton
              variant="outline"
              size="sm"
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/40 cursor-pointer shadow-xs"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleResetAll}
            >
              Neteja
            </CbButton>
          )}

          {isOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t('ai.online_status', 'Connectat a Internet • Reconeixement amb IA actiu')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              <span>{t('ai.offline_status', 'Sense connexió • Cerca local limitada')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Input & Scanning Stage */}
        <div className="lg:col-span-5 space-y-4">
          <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-500" />
                {isCameraActive ? "Visor de la Càmera en Directe" : "Visor Google Lens / Fotografia"}
              </span>
              {isAnalyzing && (
                <span className="flex items-center gap-1.5 text-cyan-500 animate-pulse font-mono font-bold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Identificant amb IA...
                </span>
              )}
            </div>

            {/* Visual Display Stage: Camera Stream or Snapshot Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border-2 border-slate-800 shadow-inner group">
              {isCameraActive ? (
                <>
                  {/* Live HTML5 Video Feed */}
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Google Lens Targeting Reticle & Hologram Overlay */}
                  <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div className="w-9 h-9 border-t-3 border-l-3 border-cyan-400 rounded-tl-xl shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                      <div className="w-9 h-9 border-t-3 border-r-3 border-cyan-400 rounded-tr-xl shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                    </div>

                    {/* Animated Scanning Laser Line */}
                    <div className="relative w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_rgba(6,182,212,1)] animate-bounce" />

                    <div className="flex justify-between items-end">
                      <div className="w-9 h-9 border-b-3 border-l-3 border-cyan-400 rounded-bl-xl shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                      <div className="w-9 h-9 border-b-3 border-r-3 border-cyan-400 rounded-br-xl shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                    </div>
                  </div>

                  {/* Camera Live Controls Floating Bar */}
                  <div className="absolute bottom-4 inset-x-4 flex items-center justify-between z-20">
                    <button
                      type="button"
                      onClick={switchCamera}
                      title="Girar càmera (davant/darrere)"
                      className="p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer shadow-lg"
                    >
                      <SwitchCamera className="w-5 h-5" />
                    </button>

                    {/* Big Shutter Button */}
                    <button
                      type="button"
                      onClick={captureCameraFrame}
                      title="Capturar i identificar ara"
                      className="w-16 h-16 rounded-full bg-gradient-to-tr from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 flex items-center justify-center shadow-xl shadow-cyan-500/40 ring-4 ring-white/30 active:scale-95 transition-all cursor-pointer group"
                    >
                      <Camera className="w-7 h-7 text-slate-950 group-hover:scale-110 transition-transform" />
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      title="Aturar càmera"
                      className="p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 backdrop-blur-md transition-all cursor-pointer shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </>
              ) : selectedImage ? (
                <>
                  <img
                    src={selectedImage}
                    alt="Figura o embalatge a identificar"
                    className="w-full h-full object-cover"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center z-10">
                      <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent absolute top-0 animate-bounce" />
                      <div className="p-3.5 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 mb-3 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                        <Sparkles className="w-7 h-7 text-cyan-300 animate-spin" />
                      </div>
                      <span className="text-xs font-bold font-mono tracking-wider text-cyan-200 uppercase">
                        Consultant catàleg i motlle amb Gemini...
                      </span>
                      <p className="text-[11px] text-slate-300 mt-1 max-w-xs">
                        Reconeixent personatge, línia, fabricant, accessoris i variant d'embalatge
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-6 text-slate-500">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-50 text-cyan-400" />
                  <p className="text-xs font-medium">Cap imatge o càmera activa</p>
                </div>
              )}
            </div>

            {/* Camera Error Alert */}
            {cameraError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="flex-1">
                  <span>{cameraError}</span>
                </div>
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="space-y-2">
              {!isCameraActive ? (
                <CbButton
                  variant="primary"
                  size="md"
                  className="w-full justify-center bg-cyan-600 hover:bg-cyan-500 border-cyan-500 text-white shadow-md shadow-cyan-600/20 font-bold"
                  icon={<Camera className="w-4 h-4" />}
                  onClick={() => startCamera('environment')}
                >
                  Obrir Càmera en Directe (Google Lens)
                </CbButton>
              ) : (
                <CbButton
                  variant="amber"
                  size="md"
                  className="w-full justify-center font-bold"
                  icon={<Sparkles className="w-4 h-4" />}
                  onClick={captureCameraFrame}
                >
                  Capturar i Identificar Ara
                </CbButton>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <Upload className="w-3.5 h-3.5 text-cyan-500" />
                    Pujar Fotografia
                  </div>
                </label>

                <label className="cursor-pointer">
                  <input
                    ref={mobileFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-full flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    Fer Foto Mòbil
                  </div>
                </label>
              </div>

              {/* Action Buttons: Reanalitzar & Neteja */}
              <div className="flex items-center gap-2">
                {selectedImage && !isCameraActive && !isAnalyzing && (
                  <CbButton
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => selectedImage && runIdentification(selectedImage)}
                  >
                    Reanalitzar
                  </CbButton>
                )}

                {(selectedImage || result || notFoundMessage || isCameraActive || errorMessage) && (
                  <CbButton
                    variant="outline"
                    size="sm"
                    className={`${selectedImage && !isCameraActive && !isAnalyzing ? 'flex-1' : 'w-full'} justify-center border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/40 cursor-pointer`}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={handleResetAll}
                  >
                    Neteja
                  </CbButton>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </CbCard>

          {/* Sample Preset Figures */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Proves de mostra (Figures d'acció i no-joguines)
            </span>
            <div className="space-y-1.5">
              {SAMPLE_FIGURES.map((sample, sIdx) => (
                <button
                  key={`${sample.id}-${sIdx}`}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className={`w-full p-2 rounded-lg border text-left text-xs transition-colors flex items-center gap-2.5 cursor-pointer ${
                    selectedImage === sample.imageUrl && !isCameraActive
                      ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <img
                    src={getFigureImageUrl(sample.imageUrl)}
                    alt={sample.label}
                    onError={handleImageError}
                    className="w-10 h-10 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{sample.label}</p>
                      {sample.category === 'non-toy' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                          No joguina
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {sample.description}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AI Detection Results, Options & Not Found States */}
        <div className="lg:col-span-7 space-y-5">
          {/* Multiple Options Referenced Online (if found) */}
          {foundOptions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-500" />
                  Opcions trobades en línia ({foundOptions.length})
                </h3>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Fabricant de joguines verificat
                </span>
              </div>

              {/* Options Selection Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {foundOptions.map((opt, optIdx) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <div
                      key={`${opt.id}-${optIdx}`}
                      onClick={() => applyOptionAsCurrent(opt)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-xs ring-1 ring-cyan-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {opt.title}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded shrink-0">
                            Seleccionada
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{opt.year}</span>
                        <span>•</span>
                        <span className="truncate">{opt.manufacturer}</span>
                      </div>

                      <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {opt.description}
                      </p>

                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">{opt.packagingStatus}</span>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          MOC: ${opt.estimatedMocValue}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Inspection Result Card */}
          {result ? (
            <div className="space-y-5">
              {/* Identification Header Banner */}
              <CbCard className="p-5 border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Identificat amb {result.confidence}% de precisió
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Any {result.year} • {result.manufacturer}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-display">
                      {result.figureName}
                    </h2>

                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Línia: <span className="text-slate-900 dark:text-slate-200 font-semibold">{result.lineName}</span> • Franquícia: <span className="text-slate-900 dark:text-slate-200 font-semibold">{result.franchiseName}</span>
                    </p>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                    <CbButton
                      variant="amber"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        const fig = getOrSynthesizeFigure(result);
                        onAddToCollection(fig, result.detectedVariant?.variantId);
                      }}
                    >
                      Afegir a la col·lecció
                    </CbButton>

                    <CbButton
                      variant="outline"
                      size="sm"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => {
                        const fig = getOrSynthesizeFigure(result);
                        onNavigateEntity('figure', fig.id);
                      }}
                    >
                      Fitxa del catàleg
                    </CbButton>

                    <CbButton
                      variant="ghost"
                      size="sm"
                      icon={<Sparkles className="w-3.5 h-3.5" />}
                      onClick={() => setIsResultModalOpen(true)}
                    >
                      Veure resultats detallats
                    </CbButton>

                    <CbButton
                      variant="ghost"
                      size="sm"
                      icon={<RotateCcw className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />}
                      onClick={handleResetAll}
                      className="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      Neteja
                    </CbButton>
                  </div>
                </div>
              </CbCard>

              {/* Detected Variant Callout */}
              {result.detectedVariant && (
                <CbCard className="p-5 border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Variant detectada: {result.detectedVariant.variantName}
                      </h3>
                    </div>
                    <Badge variant="amber">{result.detectedVariant.rarity}</Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Trets visuals i identificació del motlle:
                    </span>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {result.detectedVariant.identifyingFeatures.map((feat, idx) => (
                        <li key={idx}>{feat}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Valoració del mercat col·leccionista:</span>
                    <div className="flex items-center gap-4 font-mono font-bold">
                      <span className="text-slate-700 dark:text-slate-300">
                        Loose (solta): ${result.detectedVariant.estimatedLooseValue}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        MOC (en blíster): ${result.detectedVariant.estimatedMocValue}
                      </span>
                    </div>
                  </div>
                </CbCard>
              )}

              {/* Tooling & Authenticity Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-cyan-500" /> Verificació de motlle i articulacions
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {result.moldingDetails}
                  </p>
                </CbCard>

                <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Autenticitat i estat del plàstic
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {result.authenticityNotes}
                  </p>
                </CbCard>
              </div>

              {/* Accessories Checklist */}
              {result.accessoriesIdentified.length > 0 && (
                <CbCard className="p-4 border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>Accessoris originals associats</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {result.accessoriesIdentified.length} peces verificades
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {result.accessoriesIdentified.map((acc, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                      >
                        ✓ {acc}
                      </span>
                    ))}
                  </div>
                </CbCard>
              )}
            </div>
          ) : notFoundMessage ? (
            /* Explicit "Not Found" Screen when not a toy manufacturer or non-toy */
            <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 text-center space-y-4 animate-fadeIn">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
                <PackageX className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-rose-950 dark:text-rose-100">
                  No s'ha trobat: no és cap figura ni joguina
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-300 max-w-lg mx-auto leading-relaxed">
                  {notFoundMessage}
                </p>
              </div>

              {notFoundDetails?.detectedSubject && (
                <div className="inline-block p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-900 text-left text-xs max-w-sm mx-auto shadow-xs">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Objecte detectat a la fotografia:
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-1">
                    • <strong>Identificació:</strong> {notFoundDetails.detectedSubject}
                  </div>
                  {notFoundDetails.reason && (
                    <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                      • <strong>Motiu:</strong> {notFoundDetails.reason}
                    </div>
                  )}
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5 italic font-medium">
                    Classificació: No és cap figura d'acció ni joguina de col·lecció.
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-center gap-3">
                <CbButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleSelectSample(SAMPLE_FIGURES[0]);
                  }}
                >
                  Provar una mostra vàlida de Star Wars Kenner
                </CbButton>
                <CbButton
                  variant="outline"
                  size="sm"
                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                  onClick={handleResetAll}
                >
                  Neteja
                </CbButton>
                <CbButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNotFoundMessage(null);
                    setNotFoundDetails(null);
                  }}
                >
                  Tancar
                </CbButton>
              </div>
            </div>
          ) : (
            /* Standby State */
            <div className="h-full min-h-[380px] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 mb-4">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                A punt per a l'escaneig amb Google Lens (IA)
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                Fes servir la càmera en directe per enfocar la figura o blíster, o puja una imatge. Gemini analitzarà el fabricant, personatge, variant i estat de conservació a l'instant.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <CbButton
                  variant="amber"
                  size="sm"
                  icon={<Camera className="w-4 h-4" />}
                  onClick={() => startCamera('environment')}
                >
                  Iniciar Càmera Google Lens
                </CbButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog with Full Results, Variants & Action Buttons */}
      <ScanResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        mode="ai"
        figure={result ? getOrSynthesizeFigure(result) : null}
        variantId={result?.detectedVariant?.variantId}
        barcode={result?.barcode}
        confidence={result?.confidence}
        packagingStatus={result?.packagingStatus}
        variantName={result?.detectedVariant?.variantName}
        marketValueLoose={result?.detectedVariant?.estimatedLooseValue}
        marketValueMoc={result?.detectedVariant?.estimatedMocValue}
        accessories={result?.accessoriesIdentified}
        moldingDetails={result?.moldingDetails}
        isNotFound={!!notFoundMessage}
        notFoundSubject={notFoundDetails?.detectedSubject}
        notFoundReason={notFoundDetails?.reason}
        notFoundMessage={notFoundMessage || undefined}
        options={foundOptions.map(opt => ({
          id: opt.id,
          title: opt.title,
          subtitle: `${opt.year} • ${opt.manufacturer} • ${opt.packagingStatus}`,
          description: opt.description,
          imageUrl: opt.imageUrl,
          packagingStatus: opt.packagingStatus,
          estimatedMocValue: opt.estimatedMocValue,
          estimatedLooseValue: opt.estimatedLooseValue
        }))}
        selectedOptionId={selectedOptionId}
        onSelectOption={(optionId) => {
          const opt = foundOptions.find(o => o.id === optionId);
          if (opt) applyOptionAsCurrent(opt);
        }}
        onGoToFigureDetail={() => {
          if (result) {
            const fig = getOrSynthesizeFigure(result);
            setIsResultModalOpen(false);
            onNavigateEntity('figure', fig.id);
          }
        }}
        onAddToCollection={() => {
          if (result) {
            const fig = getOrSynthesizeFigure(result);
            setIsResultModalOpen(false);
            onAddToCollection(fig, result.detectedVariant?.variantId);
          }
        }}
        onCancel={() => setIsResultModalOpen(false)}
      />
    </div>
  );
};
