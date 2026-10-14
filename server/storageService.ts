import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Ensure public/uploads directory exists on disk for local storage fallback
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

// Optional Cloudflare R2 / AWS S3 / Backblaze B2 client configuration
let s3Client: S3Client | null = null;
const S3_BUCKET = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME || '';
const S3_PUBLIC_DOMAIN = (process.env.R2_PUBLIC_DOMAIN || process.env.S3_PUBLIC_DOMAIN || '').replace(/\/$/, '');
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';

async function uploadToImgBB(buffer: Buffer): Promise<string | null> {
  if (!IMGBB_API_KEY) return null;
  try {
    const base64Str = buffer.toString('base64');
    const formParams = new URLSearchParams();
    formParams.append('image', base64Str);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString(),
    });

    if (res.ok) {
      const data = await res.json() as any;
      if (data?.data?.url) {
        console.log('[Storage] Image persisted to ImgBB:', data.data.url);
        return data.data.url;
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.warn('[Storage] ImgBB API error:', res.status, errText);
    }
  } catch (err) {
    console.warn('[Storage] ImgBB upload failed, falling back to local disk:', err);
  }
  return null;
}

function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
  const region = process.env.AWS_REGION || 'auto';

  if (accessKeyId && secretAccessKey && S3_BUCKET) {
    try {
      s3Client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log(`[Storage] Initialized S3/R2 client for bucket: ${S3_BUCKET}`);
      return s3Client;
    } catch (err) {
      console.warn('[Storage] Could not initialize S3/R2 client, falling back to local disk:', err);
      return null;
    }
  }
  return null;
}

/**
 * Saves an optimized image buffer to object storage (Cloudflare R2 / S3) or local disk.
 * Returns the permanent public URL (e.g. "https://pub-...r2.dev/img_abc.jpg" or "/uploads/img_abc.jpg").
 */
export async function persistImageBuffer(
  buffer: Buffer,
  extension = 'jpg',
  contentType = 'image/jpeg'
): Promise<string> {
  // Generate deterministic content hash to avoid duplicate uploads
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 24);
  const fileName = `img_${hash}.${extension}`;

  const client = getS3Client();

  // 1. If ImgBB API key is provided, use ImgBB (free image hosting, zero credit card / PayPal needed)
  if (IMGBB_API_KEY) {
    const imgbbUrl = await uploadToImgBB(buffer);
    if (imgbbUrl) return imgbbUrl;
  }

  // 2. If Cloudflare R2 / S3 is configured, upload to cloud object storage
  if (client && S3_BUCKET) {
    try {
      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `figures/${fileName}`,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      });
      await client.send(command);

      if (S3_PUBLIC_DOMAIN) {
        return `${S3_PUBLIC_DOMAIN}/figures/${fileName}`;
      }
      return `/uploads/${fileName}`;
    } catch (err) {
      console.warn('[Storage] S3/R2 upload failed, saving to local disk fallback:', err);
    }
  }

  // 2. Default Local Storage: save to /public/uploads/
  const filePath = path.join(LOCAL_UPLOADS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    await fs.promises.writeFile(filePath, buffer);
  }

  return `/uploads/${fileName}`;
}

/**
 * Optimizes an image (Buffer, file or base64) with Sharp and persists it as a URL.
 * Never returns a base64 string. Always returns an HTTP or static URL.
 */
export async function optimizeAndStoreImage(
  input: Buffer | string,
  maxDimension = 1000,
  quality = 80
): Promise<string> {
  // If it's already an HTTP URL or local static URL, no need to re-upload
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/cardback_')) {
      return trimmed;
    }
  }

  let buffer: Buffer;

  if (typeof input === 'string') {
    if (input.startsWith('data:image/')) {
      const commaIndex = input.indexOf(',');
      if (commaIndex === -1) return '/cardback_placeholder.jpeg';
      const base64Data = input.substring(commaIndex + 1);
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      return '/cardback_placeholder.jpeg';
    }
  } else {
    buffer = input;
  }

  if (buffer.length === 0) {
    return '/cardback_placeholder.jpeg';
  }

  try {
    const optimizedBuffer = await sharp(buffer)
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    return await persistImageBuffer(optimizedBuffer, 'jpg', 'image/jpeg');
  } catch (err) {
    console.warn('[Storage] Sharp optimization failed:', err);
    // Even if optimization fails, save the raw buffer as fallback to avoid base64 in DB
    return await persistImageBuffer(buffer, 'jpg', 'image/jpeg');
  }
}

/**
 * Checks if Cloudflare R2 / S3 is currently enabled
 */
export function getStorageProviderInfo() {
  if (IMGBB_API_KEY) {
    return {
      provider: 'ImgBB Cloud Hosting (100% Gratuït, sense targeta ni PayPal)',
      isCloud: true,
      bucket: 'imgbb-cloud',
      publicDomain: 'https://i.ibb.co'
    };
  }

  const hasCloudStorage = Boolean(
    (process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID) &&
    (process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY) &&
    S3_BUCKET
  );

  return {
    provider: hasCloudStorage ? 'Cloudflare R2 / Amazon S3' : 'Local Fast Disk (/uploads/) - Sense comptes externs',
    isCloud: hasCloudStorage,
    bucket: S3_BUCKET || 'local-disk',
    publicDomain: S3_PUBLIC_DOMAIN || 'app-origin'
  };
}
