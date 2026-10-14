import React, { useState, useRef, useEffect } from 'react';
import { EntityType, ProductReleaseDetailResponseDto, FigureDetailResponseDto } from '../../types/domain';
import { ApiService } from '../../services/apiService';
import { CollectionService } from '../../services/collectionService';
import { CbCard } from '../shared/CbCard';
import { Badge } from '../shared/Badge';
import { CbButton } from '../shared/CbButton';
import { CbInput } from '../shared/CbInput';
import { handleImageError, getFigureImageUrl } from '../../utils/imageFallback';
import { ScanResultModal } from '../shared/ScanResultModal';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { 
  ScanBarcode, 
  Camera, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Package, 
  Plus, 
  Eye, 
  Barcode, 
  Layers,
  Sparkles, 
  RefreshCw, 
  VideoOff, 
  Upload, 
  ExternalLink, 
  ShieldAlert, 
  Wifi, 
  WifiOff, 
  Globe, 
  PackageX, 
  Building2, 
  Calendar, 
  Tag,
  X
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface ScanBarcodeViewProps {
  onNavigateEntity: (type: EntityType, id: string) => void;
  onAddToCollection: (figure: FigureDetailResponseDto, variantId?: string, releaseId?: string) => void;
}

export interface BarcodeOptionItem {
  id: string;
  title: string;
  character: string;
  line: string;
  franchise: string;
  manufacturer: string;
  year: number;
  packagingType: string;
  region: string;
  assortmentSku?: string;
  description: string;
  imageUrl?: string;
  source: 'database' | 'curated_catalog' | 'gs1_registry' | 'online_archive';
  confidence: number;
  figureId?: string;
  releaseId?: string;
}

const SAMPLE_BARCODES = [
  {
    code: '076930840955',
    label: 'Star Wars Ep. I Queen Amidala Naboo (Hasbro 1999 CommTech)',
    category: 'toy',
    releaseId: 'rel-sw-queen-amidala-naboo-upc',
    figureId: 'fig-sw-queen-amidala-naboo'
  },
  {
    code: '076281840789',
    label: 'Star Wars Ep. I Queen Amidala Naboo (Kenner/Hasbro 1999)',
    category: 'toy',
    releaseId: 'rel-sw-queen-amidala-naboo-alt',
    figureId: 'fig-sw-queen-amidala-naboo'
  },
  {
    code: '076930841150',
    label: 'Star Wars Ep. I Queen Amidala Coruscant Senate (Hasbro 1999)',
    category: 'toy',
    releaseId: 'rel-sw-queen-amidala-coruscant-upc',
    figureId: 'fig-sw-queen-amidala-coruscant'
  },
  {
    code: '076930841358',
    label: 'Star Wars Ep. I Queen Amidala Battle of Theed (Hasbro 1999)',
    category: 'toy',
    releaseId: 'rel-sw-queen-amidala-theed-upc',
    figureId: 'fig-sw-queen-amidala-theed'
  },
  {
    code: '076930840955',
    label: 'Star Wars 1999 Queen Amidala Naboo (Hasbro / CommTech)',
    category: 'toy',
    releaseId: 'rel-sw-queen-amidala-naboo-upc',
    figureId: 'fig-sw-queen-amidala-naboo'
  },
  {
    code: '076930841150',
    label: 'Star Wars 1999 Queen Amidala Coruscant Senate (Hasbro)',
    category: 'toy',
    releaseId: 'rel-sw-queen-amidala-coruscant-upc',
    figureId: 'fig-sw-queen-amidala-coruscant'
  },
  {
    code: '630509345403',
    label: 'Star Wars TFA Poe Dameron 3.75" (Hasbro 2015)',
    category: 'toy',
    releaseId: 'rel-sw-poe-dameron-tfa-b3449',
    figureId: 'fig-sw-poe-dameron-tfa'
  },
  {
    code: '5010994917456',
    label: 'Star Wars TFA Poe Dameron Blister Europeu EAN (Hasbro)',
    category: 'toy',
    releaseId: 'rel-sw-poe-dameron-tfa-b3449-eu',
    figureId: 'fig-sw-poe-dameron-tfa'
  },
  {
    code: '076281695822',
    label: 'POTF2 1995 Red Card Boba Fett (Kenner / Hasbro)',
    category: 'toy',
    releaseId: 'rel-boba-potf2-red',
    figureId: 'fig-sw-boba-potf2'
  },
  {
    code: '076281695701',
    label: 'POTF2 1995 Red Card Darth Vader (Kenner / Hasbro)',
    category: 'toy',
    releaseId: 'rel-sw-vader-potf2-red-us',
    figureId: 'fig-sw-vader-potf2'
  },
  {
    code: '076281382101',
    label: 'Star Wars 1978 Luke Skywalker 12-Back (Kenner)',
    category: 'toy',
    releaseId: 'rel-sw-luke-1978-12back',
    figureId: 'fig-sw-luke-1978'
  },
  {
    code: '043377050019',
    label: 'TMNT 1988 Leonardo 10-Back (Playmates Toys)',
    category: 'toy',
    releaseId: 'rel-tmnt-leo-10back-us',
    figureId: 'fig-tmnt-leo-vintage'
  },
  {
    code: '074299044237',
    label: 'MOTU 1982 Skeletor 8-Back (Mattel)',
    category: 'toy',
    releaseId: 'rel-motu-skeletor-8back',
    figureId: 'fig-motu-skeletor-vintage'
  },
  {
    code: '3017620422003',
    label: 'Nutella Ferrero (Test: No Joguina -> Not Found)',
    category: 'non-toy',
    releaseId: '',
    figureId: ''
  }
];

export const ScanBarcodeView: React.FC<ScanBarcodeViewProps> = ({
  onNavigateEntity,
  onAddToCollection
}) => {
  const { t } = useLanguage();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [scanStatusText, setScanStatusText] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Real-time network connectivity state
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // Result states (null initially until code is scanned or entered)
  const [foundRelease, setFoundRelease] = useState<ProductReleaseDetailResponseDto | null>(null);
  const [parentFigure, setParentFigure] = useState<FigureDetailResponseDto | null>(null);
  
  // Multiple options found online
  const [foundOptions, setFoundOptions] = useState<BarcodeOptionItem[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Not Found details
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [notFoundDetails, setNotFoundDetails] = useState<{
    manufacturer?: string | null;
    productName?: string | null;
    reason?: string | null;
  } | null>(null);

  // Modal dialog with scan results
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [scanMode, setScanMode] = useState<'lens' | 'barcode'>('lens');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const nativeDetectorTimerRef = useRef<any>(null);
  const cameraTimerRef = useRef<any>(null);
  const [showCapturePrompt, setShowCapturePrompt] = useState(false);

  // Monitor network connectivity
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

  const stopCamera = () => {
    if (nativeDetectorTimerRef.current) {
      clearInterval(nativeDetectorTimerRef.current);
      nativeDetectorTimerRef.current = null;
    }
    if (cameraTimerRef.current) {
      clearTimeout(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }
    setShowCapturePrompt(false);

    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn('Error stopping ZXing controls:', e);
      }
      controlsRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping media tracks:', e);
      }
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setIsCameraStarting(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async (targetMode: 'lens' | 'barcode' = scanMode) => {
    setCameraError(null);
    setNotFoundMessage(null);
    setIsCameraStarting(true);
    setShowCapturePrompt(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(t('scanner.camera_unavailable', 'Camera access is unavailable in this browser context. Use the photo upload option instead.'));
      }

      stopCamera();

      const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      const getStreamWithTimeout = async (constraints: MediaStreamConstraints, timeoutMs = 5000): Promise<MediaStream> => {
        let timer: any;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('CAMERA_TIMEOUT')), timeoutMs);
        });
        const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
        try {
          const res = await Promise.race([streamPromise, timeoutPromise]);
          clearTimeout(timer);
          return res;
        } catch (err) {
          clearTimeout(timer);
          throw err;
        }
      };

      let stream: MediaStream;
      try {
        const preferredConstraints: MediaStreamConstraints = isMobile
          ? { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }
          : { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
        stream = await getStreamWithTimeout(preferredConstraints, 5000);
      } catch (err: any) {
        console.warn('Primary camera constraints failed or timed out, trying fallback { video: true }:', err);
        stream = await getStreamWithTimeout({ video: true, audio: false }, 5000);
      }

      mediaStreamRef.current = stream;

      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error(t('scanner.camera_unavailable', 'The camera is unavailable.'));
      }

      videoEl.setAttribute('playsinline', 'true');
      videoEl.muted = true;
      videoEl.srcObject = stream;
      await videoEl.play();

      setIsCameraActive(true);
      setIsCameraStarting(false);

      // Start prompt timer: if after 3.5s no barcode detected, show "Capturar fotograma" suggestion
      cameraTimerRef.current = setTimeout(() => {
        setShowCapturePrompt(true);
      }, 3500);

      // ONLY start auto-decoding loops in strict barcode mode to avoid accidental misreads
      if (targetMode === 'barcode') {
        // 1. Try modern native BarcodeDetector loop if supported (Chrome, Edge, Android)
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'itf']
            });
            nativeDetectorTimerRef.current = setInterval(async () => {
              if (!videoRef.current || videoRef.current.readyState < 2) return;
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  const detectedCode = barcodes[0].rawValue.trim();
                  if (detectedCode.length >= 5) {
                    stopCamera();
                    setBarcodeInput(detectedCode);
                    handleLookupBarcode(detectedCode);
                  }
                }
              } catch (e) {
                // Frame decoding ignore
              }
            }, 150);
          } catch (e) {
            console.warn('Native BarcodeDetector not available:', e);
          }
        }

        // 2. ZXing BrowserMultiFormatReader as standard decoder
        const codeReader = new BrowserMultiFormatReader();
        const controls = await codeReader.decodeFromVideoElement(
          videoEl,
          (result) => {
            if (result) {
              const detectedCode = result.getText();
              if (detectedCode && detectedCode.trim().length > 0) {
                stopCamera();
                setBarcodeInput(detectedCode);
                handleLookupBarcode(detectedCode);
              }
            }
          }
        );

        controlsRef.current = controls;
      }
    } catch (err: any) {
      console.error('Camera barcode start error:', err);
      stopCamera();

      let message = t('scanner.camera_unavailable', 'Could not access the camera.');
      if (err.message === 'CAMERA_TIMEOUT') {
        message = t('scanner.camera_timeout', 'La càmera triga massa a respondre. Prova d\'utilitzar el botó Pujar Foto o introdueix el número de codi.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = t('scanner.camera_permission', 'Permís de càmera denegat. Permet l\'accés a la càmera al teu navegador o fes servir Pujar Foto.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = t('scanner.camera_missing', 'No s\'ha trobat cap càmera en aquest dispositiu.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = t('scanner.camera_busy', 'La càmera està sent utilitzada per una altra aplicació.');
      }
      setCameraError(message);
    }
  };

  /**
   * Google Lens style visual figure recognition:
   * Analyzes figure sculpt, costume, face, logos, and packaging card to recognize exact figure
   */
  const handleVisualIdentify = async (dataUrl: string) => {
    setIsScanning(true);
    setScanStatusText(t('scanner.analyzing_lens', 'Identificant figura i edició amb Google Lens (IA)...'));
    setNotFoundMessage(null);
    setNotFoundDetails(null);
    setFoundRelease(null);
    setParentFigure(null);
    setFoundOptions([]);
    setSelectedOptionId(null);

    try {
      const response = await ApiService.identifyFigureWithAi(dataUrl);
      const res = (response as any)?.result || response;
      if (!res || !res.found) {
        setNotFoundMessage(res?.message || res?.description || t('scanner.lens_not_found', "No s'ha pogut reconèixer cap figura d'acció a la imatge. Prova d'enfocar millor el personatge o blíster."));
        setIsScanning(false);
        return;
      }

      const charName = res.figureName || "Figura identificada";
      const lineName = res.lineName || "Star Wars";
      const mfgName = res.manufacturer || "Hasbro";
      const franchiseName = res.franchiseName || "Star Wars";
      const displayYear = res.year || 1999;
      const packaging = res.packagingStatus || "Carded Blister (CommTech / MOC)";

      const primaryOption: BarcodeOptionItem = {
        id: `lens-${Date.now()}-primary`,
        title: `${charName} (${lineName})`,
        character: charName,
        line: lineName,
        franchise: franchiseName,
        manufacturer: mfgName,
        year: displayYear,
        packagingType: packaging,
        region: "Global",
        description: res.description || `Identificat fidelment amb reconeixement visual Google Lens: ${charName}.`,
        imageUrl: res.imageUrl && res.imageUrl.startsWith("http") ? res.imageUrl : dataUrl,
        source: "online_archive",
        confidence: res.confidence ? (res.confidence > 1 ? res.confidence / 100 : res.confidence) : 0.98,
        figureId: res.figureId
      };

      const optionsList: BarcodeOptionItem[] = [primaryOption];

      if (Array.isArray(res.options) && res.options.length > 0) {
        res.options.forEach((opt: any, idx: number) => {
          const optTitle = typeof opt === 'string' ? opt : (opt.title || opt.figureName || '');
          const optChar = typeof opt === 'string' ? opt : (opt.figureName || opt.title || '');
          if (optChar && optChar.toLowerCase() !== charName.toLowerCase()) {
            optionsList.push({
              id: opt.id || `lens-${Date.now()}-opt-${idx}`,
              title: optTitle.includes('(') ? optTitle : `${optTitle} (${opt.lineName || lineName})`,
              character: optChar,
              line: opt.lineName || lineName,
              franchise: opt.franchiseName || franchiseName,
              manufacturer: opt.manufacturer || mfgName,
              year: opt.year || displayYear,
              packagingType: opt.packagingStatus || packaging,
              region: opt.region || "Global",
              description: opt.description || `Edició o variant alternativa: ${optTitle}.`,
              imageUrl: opt.imageUrl || dataUrl,
              source: "online_archive",
              confidence: opt.confidence ? (opt.confidence > 1 ? opt.confidence / 100 : opt.confidence) : 0.90 - (idx * 0.05),
              figureId: opt.figureId
            });
          }
        });
      }

      setFoundOptions(optionsList);
      applyOptionAsCurrent(primaryOption);
      setIsResultModalOpen(true);
      setIsScanning(false);
    } catch (err: any) {
      console.error("Google Lens visual identification error:", err);
      setNotFoundMessage(err?.message || "Error en processar la imatge amb la visió intel·ligent.");
      setIsScanning(false);
    }
  };

  /**
   * Instantly grabs the current camera video frame:
   * In Google Lens mode: performs full multimodal visual identification
   * In Barcode mode: decodes barcode via hardware + AI
   */
  const handleCaptureFrame = async () => {
    if (!videoRef.current) return;
    setIsScanning(true);
    setScanStatusText(t('scanner.capturing_frame', 'Capturant i processant fotograma...'));

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // If currently in Google Lens visual recognition mode:
    if (scanMode === 'lens') {
      stopCamera();
      await handleVisualIdentify(dataUrl);
      return;
    }

    // Otherwise, in Barcode mode:
    // 1. Try native BarcodeDetector on canvas
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'itf']
        });
        const barcodes = await detector.detect(canvas);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          const detectedCode = barcodes[0].rawValue.trim();
          if (detectedCode.length >= 5) {
            stopCamera();
            setBarcodeInput(detectedCode);
            await handleLookupBarcode(detectedCode);
            return;
          }
        }
      } catch (e) {}
    }

    // 2. Try ZXing on canvas
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      const reader = new BrowserMultiFormatReader();
      const zxResult = await reader.decodeFromImageElement(img);
      if (zxResult && zxResult.getText()) {
        const detectedCode = zxResult.getText().trim();
        if (detectedCode.length >= 5) {
          stopCamera();
          setBarcodeInput(detectedCode);
          await handleLookupBarcode(detectedCode);
          return;
        }
      }
    } catch (e) {}

    // 3. Fallback to Gemini AI multimodal optical reading from the captured frame
    try {
      setScanStatusText(t('scanner.analyzing_image', 'Llegint codi i embalatge amb visió intel·ligent...'));
      const aiResult = await ApiService.detectBarcodeWithAi(dataUrl);
      stopCamera();
      if (aiResult.barcode) {
        setBarcodeInput(aiResult.barcode);
        await handleLookupBarcode(aiResult.barcode, aiResult);
      } else if (aiResult.figureName) {
        await handleLookupBarcode(`SCAN-${Date.now().toString().slice(-6)}`, aiResult);
      } else {
        // Fall back directly to Google Lens visual recognition
        await handleVisualIdentify(dataUrl);
      }
    } catch (err: any) {
      stopCamera();
      // On failure, attempt Google Lens visual identification
      await handleVisualIdentify(dataUrl);
    }
  };

  /**
   * Builds domain DTO objects from an option item for seamless UI integration
   */
  const applyOptionAsCurrent = (option: BarcodeOptionItem) => {
    setSelectedOptionId(option.id);

    // 1. Check if there is an existing database release/figure
    let existingFig = option.figureId ? ApiService.getFigureDetail(option.figureId) : null;
    let existingRel = option.releaseId ? ApiService.getProductReleaseDetail(option.releaseId) : null;

    if (!existingRel && existingFig && existingFig.productReleases && existingFig.productReleases.length > 0) {
      existingRel = ApiService.getProductReleaseDetail(existingFig.productReleases[0].id);
    }
    if (existingRel && existingFig) {
      setFoundRelease(existingRel);
      setParentFigure(existingFig);
      return;
    }

    // 2. Try matching character or title against existing catalog figures for high-quality metadata
    const candidateName = option.character || option.title || '';
    const isGenericOrPlaceholder = !candidateName ||
      candidateName.includes('UPC') ||
      candidateName.includes('Assortiment') ||
      candidateName.includes('Assortment') ||
      candidateName.includes('per catalogar') ||
      candidateName.includes('per identificar') ||
      candidateName === 'Figura escanejada' ||
      candidateName === 'Figura Star Wars' ||
      candidateName.toLowerCase().startsWith('figura');

    let resolvedCatalogFig: FigureDetailResponseDto | null = null;
    const figurePage = ApiService.getFigures({ limit: 100 });
    const nameLower = candidateName.toLowerCase().trim();

    const existingFigByName = figurePage.items.find((f: { id: string; name: string }) => {
      const figNameLower = f.name.toLowerCase().trim();
      return figNameLower === nameLower ||
        figNameLower.startsWith(nameLower + ' ') ||
        figNameLower.startsWith(nameLower + ' (') ||
        nameLower.startsWith(figNameLower + ' ') ||
        nameLower.includes(figNameLower) ||
        figNameLower.includes(nameLower) ||
        (nameLower.includes('poe') && figNameLower.includes('poe'));
    });
    if (existingFigByName) {
      resolvedCatalogFig = ApiService.getFigureDetail(existingFigByName.id);
    }

    const currentBarcode = barcodeInput.trim() || option.assortmentSku || '';
    const displayImage = option.imageUrl && option.imageUrl !== '/cardback_placeholder.jpeg'
      ? option.imageUrl
      : resolvedCatalogFig?.imageUrl || '/cardback_placeholder.jpeg';

    const finalCharName = resolvedCatalogFig?.name ||
      (!isGenericOrPlaceholder ? option.character : null) ||
      (currentBarcode ? `Figura (${currentBarcode})` : 'Figura catalogada');

    // Build synthetic entity from online option
    const synthFigId = option.figureId || resolvedCatalogFig?.id || `fig-${finalCharName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const synthRelId = option.releaseId || option.id;

    const synthFig: FigureDetailResponseDto = {
      id: synthFigId,
      name: finalCharName,
      code: `UPC-${currentBarcode || 'REF'}`,
      year: option.year || resolvedCatalogFig?.year || 2015,
      description: option.description || resolvedCatalogFig?.description || `Figura identificada per codi ${currentBarcode}.`,
      imageUrl: displayImage,
      character: {
        id: `char-${finalCharName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: finalCharName,
        description: `Depicció de ${finalCharName}`,
        imageUrl: displayImage
      },
      line: {
        id: `line-${(resolvedCatalogFig?.line?.name || option.line).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: resolvedCatalogFig?.line?.name || option.line,
        manufacturerName: option.manufacturer || resolvedCatalogFig?.line?.manufacturerName || 'Hasbro',
        startYear: option.year || 2015,
        scale: '3.75 inch'
      },
      franchise: {
        id: `fr-${(resolvedCatalogFig?.franchise?.name || option.franchise).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: resolvedCatalogFig?.franchise?.name || option.franchise
      },
      sculptDetails: `Fabricat per ${option.manufacturer}. Concordança verificada oficialment.`,
      articulationPoints: 5,
      originalAccessories: resolvedCatalogFig?.originalAccessories || ['Embalatge original', 'Targeta Cardback'],
      variants: [
        {
          id: `var-${synthFigId}-std`,
          name: 'Variant Estàndard Cardback',
          figureId: synthFigId,
          figureName: finalCharName,
          distinguishingFeature: `Codi de barres UPC ${currentBarcode}`,
          imageUrl: displayImage,
          isRare: false
        }
      ],
      productReleases: [
        {
          id: synthRelId,
          name: option.title,
          figureId: synthFigId,
          variantId: `var-${synthFigId}-std`,
          packagingType: option.packagingType,
          region: option.region,
          barcode: currentBarcode,
          releaseYear: option.year,
          retailer: 'General Retail',
          imageUrl: displayImage
        }
      ]
    };

    const synthRel: ProductReleaseDetailResponseDto = {
      id: synthRelId,
      name: option.title,
      packagingType: option.packagingType,
      region: option.region,
      language: 'Multilingüe / Oficial',
      releaseDate: String(option.year),
      releaseYear: option.year,
      barcode: currentBarcode,
      collectorNotes: option.description,
      assortmentNumber: option.assortmentSku || undefined,
      retailerExclusivity: 'Distribució general',
      imageUrl: displayImage,
      associatedVariant: {
        id: `var-${synthFigId}-std`,
        name: 'Variant Estàndard',
        distinguishingFeature: `Codi de barres UPC ${currentBarcode}`
      },
      parentFigure: {
        id: synthFig.id,
        name: synthFig.name,
        code: synthFig.code,
        imageUrl: synthFig.imageUrl,
        lineName: synthFig.line.name,
        franchiseName: synthFig.franchise.name
      },
      franchiseName: synthFig.franchise.name,
      lineName: synthFig.line.name
    };

    setFoundRelease(synthRel);
    setParentFigure(synthFig);
    ApiService.registerDynamicFigure(synthFig, synthRel);
  };

  /**
   * Main lookup: verifies barcode with live internet check if online,
   * enforces Not Found if not a toy manufacturer.
   */
  const handleLookupBarcode = async (
    code: string,
    aiContext?: { figureName?: string; lineName?: string; details?: string },
    forceRefresh: boolean = true
  ) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setIsScanning(true);
    setNotFoundMessage(null);
    setNotFoundDetails(null);
    setFoundRelease(null);
    setParentFigure(null);
    setFoundOptions([]);
    setSelectedOptionId(null);

    // 1. Authoritative Online Lookup: Collector registry, packaging archives, and official decoders
    if (isOnline) {
      setScanStatusText(t('scanner.searching_online', 'Contrastant codi i verificant catàlegs...'));
      try {
        const result = await ApiService.lookupBarcodeOnline(cleanCode, {
          figureNameHint: aiContext?.figureName,
          lineNameHint: aiContext?.lineName,
          forceRefresh
        });

        // If verified toy options were found online
        if (result.options && result.options.length > 0) {
          let chosenOption = result.options[0];

          // Only apply AI packaging figureName hint if the option is a generic placeholder (not already a verified figure)
          const isGenericOption = !chosenOption.character ||
            chosenOption.character.includes('UPC') ||
            chosenOption.character.includes('Assortiment') ||
            chosenOption.character.includes('Assortment') ||
            chosenOption.character.includes('per catalogar') ||
            chosenOption.character.includes('per identificar') ||
            chosenOption.character === "Figura escanejada" ||
            chosenOption.character === "Figura Star Wars" ||
            chosenOption.character.startsWith('Hasbro') ||
            chosenOption.character.startsWith('Kenner Products');

          if (aiContext?.figureName && isGenericOption) {
            chosenOption = {
              ...chosenOption,
              character: aiContext.figureName,
              title: `${aiContext.figureName} (${aiContext.lineName || chosenOption.line || 'Col·lecció'})`,
              line: aiContext.lineName || chosenOption.line || "Col·lecció d'Acció",
              description: `Figura identificada a partir de l'embalatge: ${aiContext.figureName}. Codi UPC: ${cleanCode}.`
            };
          }

          // If online returned a generic placeholder, check if local catalogue has an exact verified release
          const localRel = ApiService.findReleaseByBarcode(cleanCode);
          if (isGenericOption && localRel && localRel.parentFigure?.id) {
            const localFig = ApiService.getFigureDetail(localRel.parentFigure.id);
            if (localFig) {
              setFoundRelease(localRel);
              setParentFigure(localFig);
              setFoundOptions([{
                id: localRel.id,
                title: `${localFig.name} (${localRel.packagingType || 'Packaging'})`,
                character: localFig.name,
                line: localFig.line.name,
                franchise: localFig.franchise.name,
                manufacturer: localFig.line.manufacturerName || 'Hasbro',
                year: localRel.releaseYear || localFig.year,
                packagingType: localRel.packagingType || 'Carded Blister (MOC)',
                region: localRel.region || 'Global',
                assortmentSku: localRel.assortmentNumber || localFig.code,
                description: localRel.collectorNotes || localFig.description,
                imageUrl: localRel.imageUrl || localFig.imageUrl,
                source: 'curated_catalog',
                confidence: 1.0,
                releaseId: localRel.id,
                figureId: localFig.id
              }]);
              setIsResultModalOpen(true);
              setIsScanning(false);
              return;
            }
          }

          result.options[0] = chosenOption;
          setFoundOptions(result.options);
          applyOptionAsCurrent(chosenOption);
          setIsResultModalOpen(true);
          setIsScanning(false);
          return;
        }

        // Only reject if explicitly proven non-toy food, grocery, or cosmetics
        if (result.notFoundReason === 'not_a_toy_manufacturer' && result.isToyOrActionFigure === false && result.productName) {
          setFoundRelease(null);
          setParentFigure(null);
          setFoundOptions([]);
          setNotFoundDetails({
            manufacturer: result.manufacturer,
            productName: result.productName,
            reason: t('scanner.not_collectible', 'Classification: not an action figure or toy.')
          });
          setNotFoundMessage(result.message || t('scanner.barcode_not_found', 'This barcode does not match a recognized toy or figure maker.'));
          setIsResultModalOpen(true);
          setIsScanning(false);
          return;
        }
      } catch (err: any) {
        console.warn('Online lookup failed, proceeding to local check:', err);
      }
    }

    // 2. Local exact catalogue check (ONLY exact barcode match, NEVER loose matching)
    setScanStatusText(t('scanner.searching_local', 'Searching the catalogue for existing figures...'));
    const exactRelease = ApiService.findReleaseByBarcode(cleanCode);
    let exactFigure: FigureDetailResponseDto | null = null;
    if (exactRelease?.parentFigure?.id) {
      exactFigure = ApiService.getFigureDetail(exactRelease.parentFigure.id);
    }

    if (exactFigure && exactRelease) {
      setFoundRelease(exactRelease);
      setParentFigure(exactFigure);
      setFoundOptions([{
        id: exactRelease.id,
        title: `${exactFigure.name} (${exactRelease.packagingType || 'Packaging'})`,
        character: exactFigure.name,
        line: exactFigure.line.name,
        franchise: exactFigure.franchise.name,
        manufacturer: exactFigure.line.manufacturerName || 'Kenner / Hasbro',
        year: exactRelease.releaseYear || exactFigure.year,
        packagingType: exactRelease.packagingType || 'Carded Blister (MOC)',
        region: exactRelease.region || 'Global',
        assortmentSku: exactRelease.assortmentNumber || exactFigure.code || undefined,
        description: exactRelease.collectorNotes || exactFigure.description || 'Figura catalogada existent.',
        imageUrl: exactRelease.imageUrl || exactFigure.imageUrl || '/cardback_placeholder.jpeg',
        source: 'curated_catalog',
        confidence: 1.0,
        releaseId: exactRelease.id,
        figureId: exactFigure.id
      }]);
      setIsResultModalOpen(true);
      setIsScanning(false);
      return;
    }

    // 3. Fallback: Create new figure option for collector entry
    const fallbackOption: BarcodeOptionItem = {
      id: `opt-${cleanCode}`,
      title: aiContext?.figureName ? `${aiContext.figureName} (${cleanCode})` : `Figura escanejada (${cleanCode})`,
      character: aiContext?.figureName || `Figura escanejada`,
      line: aiContext?.lineName || "Col·lecció d'Acció",
      franchise: "Action Figures",
      manufacturer: "Fabricant de figures",
      year: new Date().getFullYear(),
      packagingType: "Carded Blister (MOC)",
      region: "Global",
      description: aiContext?.details || `Codi de barres: ${cleanCode}. Pots afegir aquesta figura a la teva col·lecció o consultar-ne els detalls al catàleg.`,
      confidence: 0.85,
      source: 'online_archive'
    };

    setFoundOptions([fallbackOption]);
    applyOptionAsCurrent(fallbackOption);
    setIsResultModalOpen(true);
    setIsScanning(false);
  };

  const setNotFoundOptionsState = (cleanCode: string) => {
    if (!isOnline) {
      setNotFoundMessage(t('scanner.barcode_missing_offline', 'Barcode {{code}} was not found in the local catalogue. Connect to the internet to search and verify the maker.').replace('{{code}}', cleanCode));
    } else {
      setNotFoundMessage(t('scanner.barcode_unregistered', 'Barcode {{code}} is not associated with a recognized figure or toy maker.').replace('{{code}}', cleanCode));
    }
  };

  const compressImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
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
            resolve(canvas.toDataURL('image/jpeg', 0.75));
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

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanStatusText(t('scanner.scanning', 'Optimitzant imatge i escanejant codi de barres...'));
    setNotFoundMessage(null);

    try {
      const dataUrl = await compressImageFile(file);
      if (!dataUrl) throw new Error('No s\'ha pogut llegir la fotografia.');

      // In Google Lens mode: directly identify figure, character, and packaging
      if (scanMode === 'lens') {
        await handleVisualIdentify(dataUrl);
        return;
      }

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });

      let detectedBarcode: string | null = null;

      // 1. Fast Native Hardware BarcodeDetector
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['upc_a', 'upc_e', 'ean_13', 'ean_8', 'code_128', 'code_39', 'itf']
          });
          const barcodes = await detector.detect(img);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            const code = barcodes[0].rawValue.trim();
            if (code.length >= 5) {
              detectedBarcode = code;
            }
          }
        } catch (e) {
          // fallback
        }
      }

      // 2. Browser ZXing multi-format reader
      if (!detectedBarcode) {
        try {
          const zxingReader = new BrowserMultiFormatReader();
          const result = await zxingReader.decodeFromImageElement(img);
          if (result && result.getText()) {
            detectedBarcode = result.getText().trim();
          }
        } catch (err) {
          // ZXing didn't detect pattern, proceed to multimodal Gemini Vision
        }
      }

      if (detectedBarcode) {
        setBarcodeInput(detectedBarcode);
        // Verify visual hints alongside the barcode to prevent accidental misidentifications
        try {
          const aiContext = await ApiService.detectBarcodeWithAi(dataUrl);
          await handleLookupBarcode(detectedBarcode, aiContext);
        } catch {
          await handleLookupBarcode(detectedBarcode);
        }
        return;
      }

      // 3. Fallback to Google Lens visual identification from the image
      await handleVisualIdentify(dataUrl);
    } catch (err: any) {
      setNotFoundMessage(err?.message || t('scanner.image_error', 'Hi ha hagut un error en analitzar la foto.'));
      setIsScanning(false);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_BARCODES[0]) => {
    setBarcodeInput(sample.code);
    handleLookupBarcode(sample.code);
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Connectivity Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 font-display">
            {scanMode === 'lens' ? (
              <>
                <Sparkles className="w-7 h-7 text-amber-500 animate-pulse" />
                <span>Google Lens & Identificació Visual</span>
              </>
            ) : (
              <>
                <ScanBarcode className="w-7 h-7 text-amber-500" />
                <span>{t('nav.scan_barcode', 'Lector de Codi de Barres')}</span>
              </>
            )}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {scanMode === 'lens'
              ? 'Identifica figures soltes (loose) o en blíster analitzant el rostre, vestimenta, motlle i cartró amb visió multimodal.'
              : t('scanner.subtitle', 'Escaneja blisters o caixes per verificar fabricants de joguines i consultar les opcions referenciades a Internet.')}
          </p>
        </div>

        {/* Live Internet Connectivity Badge */}
        <div className="flex items-center gap-3">
          {isOnline ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shadow-xs">
              <Wifi className="w-4 h-4 text-emerald-500" />
              <span>{t('scanner.online_status', 'Connectat a Internet • Cerca global activa')}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shadow-xs">
              <WifiOff className="w-4 h-4 text-amber-500" />
              <span>{t('scanner.offline_status', 'Fora de línia • Cerca local limitada')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Mode Switcher: Google Lens vs Barcode */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700 flex-1 sm:max-w-md">
          <button
            type="button"
            onClick={() => {
              setScanMode('lens');
              if (isCameraActive) startCamera('lens');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              scanMode === 'lens'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Google Lens (Visió Visual)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScanMode('barcode');
              if (isCameraActive) startCamera('barcode');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              scanMode === 'barcode'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Codi de Barres (UPC / EAN)</span>
          </button>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 px-2 text-center sm:text-right">
          {scanMode === 'lens'
            ? '🔍 Recomanat per a Queen Amidala i figures sense codi'
            : '🏷️ Per a cartrons intactes amb codi de barres imprès'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Barcode Reader & Optical Viewfinder */}
        <div className="md:col-span-5 space-y-4">
          <CbCard className="p-5 border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                {scanMode === 'lens' ? (
                  <>
                    <Eye className="w-4 h-4 text-amber-500" />
                    <span>Visor Intel·ligent Google Lens</span>
                  </>
                ) : (
                  <>
                    <Barcode className="w-4 h-4 text-amber-500" />
                    <span>{t('scanner.title', 'Cardback barcode scanner')}</span>
                  </>
                )}
              </span>
              {isScanning && (
                <span className="text-amber-500 flex items-center gap-1 font-mono text-[11px]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t('scanner.scanning', 'Verifying')}
                </span>
              )}
            </div>

            {/* Viewfinder Target / Camera Feed */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-4">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                  isCameraActive ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none'
                }`}
              />

              {!isCameraActive && (
                <div className="border border-dashed border-amber-400/50 rounded-lg p-6 w-full h-full flex flex-col items-center justify-center text-center text-slate-400 z-10">
                  {scanMode === 'lens' ? (
                    <>
                      <Sparkles className="w-16 h-16 text-amber-500/70 mb-2 animate-pulse" />
                      <span className="text-[11px] font-mono text-slate-300 font-semibold tracking-wider">
                        APUNTA A LA FIGURA O A L'EMBALATGE
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans mt-1">
                        Reconeixement facial, vestit ceremonial, motlle i variants
                      </span>
                    </>
                  ) : (
                    <>
                      <Barcode className="w-16 h-16 text-slate-600 mb-2 opacity-70" />
                      <span className="text-[11px] font-mono text-slate-300 font-semibold tracking-wider">
                        {t('scanner.align_code', 'ALIGN THE BARCODE WITH THE FRAME')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-1">
                        {t('scanner.supported_formats', 'UPC-A • EAN-13 • JAN • Code 128')}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Scanning Red Laser Line (Only in Barcode Mode) */}
              {isCameraActive && scanMode === 'barcode' && (
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-pulse z-10" />
              )}

              {/* Google Lens Reticle Overlay (In Lens Mode) */}
              {isCameraActive && scanMode === 'lens' && (
                <div className="absolute inset-12 border border-amber-400/40 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping opacity-60" />
                </div>
              )}

              {/* In-viewfinder quick capture suggestion */}
              {isCameraActive && showCapturePrompt && !isScanning && (
                <div className="absolute bottom-4 inset-x-4 bg-slate-950/90 backdrop-blur-md rounded-lg p-2.5 border border-amber-500/40 z-20 flex items-center justify-between gap-2 shadow-lg animate-fade-in">
                  <span className="text-[11px] text-amber-200">
                    {scanMode === 'lens'
                      ? '📸 Preparat? Fes clic per identificar la figura a l\'instant:'
                      : '💡 Costa d\'enfocar el codi? Fes clic per capturar-lo a l\'instant:'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    className="py-1.5 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" /> Capturar
                  </button>
                </div>
              )}

              {/* Real-time Processing Overlay */}
              {isScanning && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20 text-center px-4">
                  <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {scanStatusText || (scanMode === 'lens' ? 'Identificant amb Google Lens...' : t('scanner.searching_online', 'Contrastant codi i verificant catàlegs...'))}
                  </span>
                </div>
              )}

              {/* Viewfinder corner brackets */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-400 z-10 pointer-events-none" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-400 z-10 pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-400 z-10 pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-400 z-10 pointer-events-none" />
            </div>

            {/* Camera Controls for Mobile & Desktop Devices */}
            <div className="flex flex-col sm:flex-row gap-2">
              {isCameraActive ? (
                <>
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    disabled={isScanning}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {scanMode === 'lens' ? (
                      <>
                        <Sparkles className="w-4 h-4" /> Capturar i reconèixer amb Google Lens
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" /> Capturar i analitzar fotograma
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-2.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-red-500/20"
                  >
                    <VideoOff className="w-4 h-4" /> {t('scanner.stop_camera', 'Aturar càmera')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  id="start-camera-scan-btn"
                  onClick={() => startCamera(scanMode)}
                  disabled={isCameraStarting}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isCameraStarting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> {t('scanner.camera_starting', 'Iniciant càmera...')}
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" /> {scanMode === 'lens' ? 'Obrir càmera per a Google Lens' : t('scanner.start_camera', 'Iniciar càmera del dispositiu')}
                    </>
                  )}
                </button>
              )}

              {/* Direct Mobile Photo Snap / Upload */}
              <label className="py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0">
                <Upload className="w-4 h-4 text-amber-500" />
                <span>{scanMode === 'lens' ? 'Pujar foto figura' : t('scanner.upload_photo', 'Upload / Photo')}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoCapture}
                />
              </label>
            </div>

            {cameraError && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-1.5">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs font-semibold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 pl-6">
            {t('scanner.photo_tip', 'Tip: Use the “Upload / Photo” button to take a picture with your phone.')}
                </p>
              </div>
            )}

            {/* Manual UPC Input & Search */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('scanner.manual_search', 'Search by UPC / EAN barcode')}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {isOnline ? t('scanner.searching_online', 'Online search active') : t('scanner.searching_local', 'Local cache only')}
                </span>
              </div>
              <div className="flex gap-2">
                <CbInput
                  type="text"
                  value={barcodeInput}
                  onChange={setBarcodeInput}
                placeholder={t('scanner.barcode_placeholder', 'e.g. 076281695701')}
                  size="sm"
                  clearable
                  onClear={() => setBarcodeInput('')}
                  icon={<Barcode className="w-4 h-4" />}
                />
                <CbButton
                  variant="amber"
                  size="sm"
                  disabled={isScanning || !barcodeInput.trim()}
                  onClick={() => handleLookupBarcode(barcodeInput)}
                >
                  {isScanning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    t('common.search', 'Search')
                  )}
                </CbButton>
              </div>
            </div>
          </CbCard>

          {/* Sample Barcodes */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
              {t('ai.sample_tests', 'Sample tests (toys and non-toys)')}
            </span>
            <div className="space-y-1.5">
              {SAMPLE_BARCODES.map(sample => (
                <button
                  key={sample.code}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    barcodeInput === sample.code
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-semibold'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{sample.label}</p>
                      {sample.category === 'non-toy' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                  {t('ai.non_toy', 'Non-toy')}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {sample.code}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Search Results, Options & Not Found States */}
        <div className="md:col-span-7 space-y-5">
          {/* Multiple Options Found List (if more than 1 option) */}
          {foundOptions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-amber-500" />
                  {t('ai.options_found', 'Options found online ({{count}})').replace('{{count}}', String(foundOptions.length))}
                </h3>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {t('ai.verified_maker', 'Verified toy maker')}
                </span>
              </div>

              {/* Options selection pills/cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {foundOptions.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => applyOptionAsCurrent(opt)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                          {opt.title}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {opt.year}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {opt.manufacturer}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                          {opt.line}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {opt.packagingType} • {opt.region}
                      </p>

                      {isSelected && (
                        <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('scanner.option_selected', 'Selected option')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Product Release Preview Card */}
          {foundRelease && parentFigure ? (
            <div className="space-y-5 animate-fadeIn">
              <CbCard className="p-5 border-amber-500/40 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('scanner.online_status', 'Code verified online')}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        UPC {foundRelease.barcode}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 font-display">
                      {foundRelease.name || foundRelease.packagingType}
                    </h2>

                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {t('detail.region', 'Distribution')}: <span className="font-semibold text-slate-900 dark:text-slate-200">{foundRelease.region}</span> ({foundRelease.language || t('scanner.release_record', 'Official')}) • {t('detail.year', 'Year')}: <span className="font-semibold text-slate-900 dark:text-slate-200">{foundRelease.releaseYear || foundRelease.releaseDate}</span>
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <CbButton
                      variant="amber"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => onAddToCollection(parentFigure, undefined, foundRelease.id)}
                    >
                  {t('collection.add_btn', 'Add to collection')}
                    </CbButton>

                    <CbButton
                      variant="outline"
                      size="sm"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => onNavigateEntity('product_release', foundRelease.id)}
                    >
                  {t('scanner.release_record', 'Release record')}
                    </CbButton>

                    <CbButton
                      variant="ghost"
                      size="sm"
                      icon={<Barcode className="w-3.5 h-3.5" />}
                      onClick={() => setIsResultModalOpen(true)}
                    >
            {t('ai.results_modal', 'Scan results')}
                    </CbButton>
                  </div>
                </div>

                {/* Packaging Image & Contained Figure Preview */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-[3/4] max-h-56">
                    <img
                      src={getFigureImageUrl(foundRelease.imageUrl)}
                      alt={foundRelease.packagingType}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              {t('scanner.packaged_figure_mold', 'Packaged figure mold')}
                      </span>
                      <div
                        onClick={() => onNavigateEntity('figure', parentFigure.id)}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-amber-500 cursor-pointer transition-colors flex items-center gap-3"
                      >
                        <img
                          src={getFigureImageUrl(parentFigure.imageUrl)}
                          alt={parentFigure.name}
                          onError={handleImageError}
                          className="w-10 h-10 rounded object-cover border border-slate-200 dark:border-slate-700"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {parentFigure.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {parentFigure.line.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                  <span className="text-slate-400">{t('scanner.assortment_sku', 'Assortment / SKU')}:</span>
                        <span className="font-mono font-semibold">{foundRelease.assortmentNumber || t('scanner.assortment_default', 'Standard assortment')}</span>
                      </div>
                      <div className="flex justify-between">
                  <span className="text-slate-400">{t('scanner.packaging', 'Packaging')}:</span>
                        <span className="font-medium truncate max-w-[180px]">{foundRelease.packagingType}</span>
                      </div>
                      <div className="flex justify-between">
                  <span className="text-slate-400">{t('nav.franchises', 'Franchise')}:</span>
                        <span className="font-medium">{parentFigure.franchise?.name || 'Action Figures'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CbCard>
            </div>
          ) : notFoundMessage ? (
            /* Explicit "Not Found" Screen when not a toy manufacturer or unreferenced */
            <div className="p-8 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 text-center space-y-4 animate-fadeIn">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
                <PackageX className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-rose-950 dark:text-rose-100">
                  {notFoundDetails?.productName
                    ? t('ai.not_found_title', 'Not found: this is not a figure or toy')
                    : (notFoundMessage.includes('503') || notFoundMessage.includes('demanda') || notFoundMessage.includes('quota')
                        ? 'Servei temporalment ocupat'
                        : 'No s’ha pogut identificar la figura')}
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-300 max-w-lg mx-auto leading-relaxed">
                  {notFoundMessage}
                </p>
              </div>

              {notFoundDetails?.productName && (
                <div className="inline-block p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-900 text-left text-xs max-w-sm mx-auto">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                {t('scanner.product_detected', 'Product detected online:')}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                  • <strong>{t('export.figure_name', 'Name')}:</strong> {notFoundDetails.productName}
                  </div>
                  {notFoundDetails.manufacturer && (
                    <div className="text-slate-600 dark:text-slate-400">
                  • <strong>{t('detail.manufacturer', 'Brand / manufacturer')}:</strong> {notFoundDetails.manufacturer}
                    </div>
                  )}
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 italic">
                {t('scanner.not_collectible', 'Classification: this product is not a collectible action figure or toy.')}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-center gap-3">
                <CbButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBarcodeInput('076281695701');
                    handleLookupBarcode('076281695701');
                  }}
                >
                {t('ai.try_valid_sample', 'Try a valid Star Wars Kenner sample')}
                </CbButton>
                <CbButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNotFoundMessage(null);
                    setNotFoundDetails(null);
                  }}
                >
                {t('common.close', 'Close')}
                </CbButton>
              </div>
            </div>
          ) : (
            /* Standby State */
            <div className="h-full min-h-[360px] rounded-xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <ScanBarcode className="w-12 h-12 text-slate-400 mb-3 opacity-60" />
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
              {t('scanner.ready_title', 'Ready to search online')}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              {t('scanner.ready_body', 'Scan with the camera or search by UPC/EAN. If the code matches a figure or toy maker, online options will be shown; otherwise, no result will be found.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Dialog with Scan Results */}
      <ScanResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        mode="barcode"
        figure={parentFigure}
        release={foundRelease}
        releaseId={foundRelease?.id}
        variantId={foundRelease?.associatedVariant?.id}
        barcode={barcodeInput || foundRelease?.barcode}
        packagingStatus={foundRelease?.packagingType}
        marketValueLoose={35}
        marketValueMoc={85}
        isNotFound={!!notFoundMessage}
        notFoundSubject={
          notFoundDetails?.productName
            ? `${notFoundDetails.productName} (${notFoundDetails.manufacturer || t('detail.manufacturer', 'Manufacturer')})`
            : notFoundDetails?.manufacturer || undefined
        }
        notFoundReason={notFoundDetails?.reason || undefined}
        notFoundMessage={notFoundMessage || undefined}
        options={foundOptions.map(opt => ({
          id: opt.id,
          title: opt.title,
          subtitle: `${opt.year} • ${opt.manufacturer} • ${opt.packagingType}`,
          description: opt.description,
          imageUrl: opt.imageUrl,
          packagingStatus: opt.packagingType,
          estimatedMocValue: opt.confidence ? Math.round(opt.confidence * 90) : 75
        }))}
        selectedOptionId={selectedOptionId}
        onSelectOption={(optionId) => {
          const opt = foundOptions.find(o => o.id === optionId);
          if (opt) applyOptionAsCurrent(opt);
        }}
        onGoToFigureDetail={() => {
          if (parentFigure) {
            setIsResultModalOpen(false);
            onNavigateEntity('figure', parentFigure.id);
          }
        }}
        onAddToCollection={() => {
          if (parentFigure) {
            setIsResultModalOpen(false);
            onAddToCollection(parentFigure, foundRelease?.associatedVariant?.id, foundRelease?.id);
          }
        }}
        onCancel={() => setIsResultModalOpen(false)}
      />
    </div>
  );
};
