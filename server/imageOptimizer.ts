import { optimizeAndStoreImage } from './storageService.js';

/**
 * Server-Side Image Optimizer & Storage Bridge
 * Converts raw high-resolution base64 photos uploaded by users into lightweight
 * compressed JPEG image files on disk or Cloudflare R2 / S3 storage.
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * This function NEVER returns a data:image base64 string.
 * It ALWAYS returns a clean, lightweight URL (e.g. "/uploads/img_abc123.jpg" or "https://...")
 * ensuring PostgreSQL database egress and storage stay near zero (~40 bytes per row).
 */
export async function optimizeImageDataUrl(
  dataUrl: string | null | undefined,
  maxDimension = 1000,
  quality = 80
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return '/cardback_placeholder.jpeg';
  }

  const trimmed = dataUrl.trim();

  // If already an HTTP/HTTPS URL or static image URL, return it directly
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/cardback_')) {
    return trimmed;
  }

  // If it's a data URL, optimize and persist to disk/cloud storage
  if (trimmed.startsWith('data:image/')) {
    return await optimizeAndStoreImage(trimmed, maxDimension, quality);
  }

  return '/cardback_placeholder.jpeg';
}

/**
 * Converts an array of image strings into clean image URLs.
 * Replaces any base64 with a saved file URL.
 */
export async function optimizeImageArray(
  images: any[] | undefined | null,
  maxDimension = 1000,
  quality = 80
): Promise<string[]> {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const results: string[] = [];
  for (const img of images) {
    if (typeof img === 'string' && img.trim()) {
      const url = await optimizeImageDataUrl(img.trim(), maxDimension, quality);
      if (url && !results.includes(url)) {
        results.push(url);
      }
    }
  }

  return results;
}
