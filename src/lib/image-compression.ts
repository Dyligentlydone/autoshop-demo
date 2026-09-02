/**
 * Client-side image compression for attachment uploads.
 *
 * iPad/iPhone cameras produce 5-15MB images. Uploading the raw original over
 * shop WiFi routinely exceeds 60s and gets killed by the client or the proxy
 * (observed as HTTP 499 / ECONNRESET). Downscaling and re-encoding to JPEG in
 * the browser cuts a typical photo to well under 1MB.
 *
 * Re-encoding through canvas also converts HEIC to JPEG, which avoids the
 * inconsistent MIME types iOS Safari reports for HEIC files.
 */

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

/**
 * iOS Safari caps total canvas memory across the page (~16.7M pixels). A fresh
 * canvas per photo exhausts that after a handful of images and crashes the tab,
 * which surfaces to the user as Safari's "Retry" screen. Reuse one canvas and
 * shrink it back to 0x0 once we're done with it.
 */
let sharedCanvas: HTMLCanvasElement | null = null;

const getCanvas = (width: number, height: number) => {
  if (!sharedCanvas) sharedCanvas = document.createElement('canvas');
  sharedCanvas.width = width;
  sharedCanvas.height = height;
  return sharedCanvas;
};

const releaseCanvas = () => {
  if (!sharedCanvas) return;
  sharedCanvas.width = 0;
  sharedCanvas.height = 0;
};

const hasImageExtension = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.includes(ext);
};

const isImage = (file: File) =>
  file.type.startsWith('image/') || (!file.type && hasImageExtension(file.name));

type CompressOptions = {
  /** Longest edge in pixels after downscaling. */
  maxDimension?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
  /** Files at or below this size are uploaded untouched. */
  skipBelowBytes?: number;
};

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  // createImageBitmap decodes off the main thread and handles orientation.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode image'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Downscale and re-encode an image file. Videos and unrecognized files are
 * returned unchanged. If anything fails, the original file is returned so the
 * upload still has a chance to succeed.
 */
export const compressImage = async (
  file: File,
  options: CompressOptions = {}
): Promise<File> => {
  // 2560px / 0.9 keeps enough detail to pinch-zoom into damage or read a DOT
  // code, while still cutting a 12MP camera photo from ~12MB to ~1.3MB.
  const maxDimension = options.maxDimension ?? 2560;
  const quality = options.quality ?? 0.9;
  const skipBelowBytes = options.skipBelowBytes ?? 1024 * 1024;

  if (!isImage(file)) return file;
  if (file.size <= skipBelowBytes) return file;

  let source: ImageBitmap | HTMLImageElement | null = null;

  try {
    source = await loadBitmap(file);
    const srcWidth = source.width;
    const srcHeight = source.height;
    if (!srcWidth || !srcHeight) return file;

    const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
    const width = Math.round(srcWidth * scale);
    const height = Math.round(srcHeight * scale);

    const canvas = getCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

    // Free the full-resolution decode as soon as it has been drawn. A 12MP
    // bitmap is ~48MB of pixels, so holding it any longer is wasteful.
    if (source && 'close' in source && typeof source.close === 'function') {
      source.close();
      source = null;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) return file;

    // Keep the original if re-encoding somehow made it bigger.
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const compressed = new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    console.info(
      `[image-compression] ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB ` +
        `-> ${(compressed.size / 1024 / 1024).toFixed(2)}MB ` +
        `(${srcWidth}x${srcHeight} -> ${width}x${height})`
    );

    return compressed;
  } catch (err) {
    console.warn('[image-compression] falling back to original file:', err);
    return file;
  } finally {
    if (source && 'close' in source && typeof source.close === 'function') {
      source.close();
    }
    releaseCanvas();
  }
};
