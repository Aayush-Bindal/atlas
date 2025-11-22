/**
 * Compression options for enhanced image processing
 */
export interface CompressionOptions {
  maxWidth?: number;        // Default: 1000px
  maxHeight?: number;       // Default: 1000px
  quality?: number;         // 0.1-1.0, default: adaptive
  format?: 'jpeg' | 'webp'; // Default: auto-detect
  progressive?: boolean;    // Default: true for JPEG
  targetSizeKB?: number;    // Target file size, default: 300KB
}

/**
 * Check if WebP format is supported by the browser
 */
function checkWebPSupport(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Analyze image complexity to determine optimal quality
 */
function analyzeImageComplexity(canvas: HTMLCanvasElement): 'simple' | 'complex' {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'complex';

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let colorVariance = 0;
  let edgeCount = 0;

  // Sample pixels for analysis (every 4th pixel for performance)
  for (let i = 0; i < data.length; i += 16) { // RGBA, so skip every 4 pixels
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Simple edge detection (compare with neighboring pixel)
    if (i > 4) {
      const prevR = data[i - 4];
      const prevG = data[i - 3];
      const prevB = data[i - 2];

      const diff = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
      if (diff > 30) edgeCount++;
    }

    // Color variance calculation
    colorVariance += (r * r + g * g + b * b);
  }

  const avgVariance = colorVariance / (data.length / 4);
  const edgeRatio = edgeCount / (data.length / 16);

  // Determine complexity based on variance and edges
  if (avgVariance < 10000 && edgeRatio < 0.1) return 'simple';
  return 'complex';
}

/**
 * Get adaptive quality based on image complexity and target size
 */
function getAdaptiveQuality(
  complexity: 'simple' | 'complex',
  targetSizeKB: number = 300
): number {
  const baseQuality = complexity === 'simple' ? 0.7 : 0.85;

  // Adjust quality based on target size
  if (targetSizeKB < 100) return Math.max(0.3, baseQuality - 0.3);
  if (targetSizeKB < 200) return Math.max(0.5, baseQuality - 0.2);
  if (targetSizeKB > 500) return Math.min(0.95, baseQuality + 0.1);

  return baseQuality;
}

/**
 * Get compressed image size in KB
 */
function getCompressedSizeKB(base64: string): number {
  // Remove data URL prefix and calculate size
  const base64Data = base64.split(',')[1];
  return (base64Data.length * 3) / 4 / 1024; // Base64 is ~33% larger
}

/**
 * Compress image with optimal quality for target size
 */
function compressToTargetSize(
  canvas: HTMLCanvasElement,
  format: 'jpeg' | 'webp',
  targetSizeKB: number
): string {
  let quality = 0.8;
  let result = canvas.toDataURL(`image/${format}`, quality);
  let size = getCompressedSizeKB(result);

  // Binary search for optimal quality
  let minQuality = 0.1;
  let maxQuality = 1.0;

  for (let i = 0; i < 6; i++) { // 6 iterations for good precision
    if (size <= targetSizeKB) {
      minQuality = quality;
    } else {
      maxQuality = quality;
    }

    quality = (minQuality + maxQuality) / 2;
    result = canvas.toDataURL(`image/${format}`, quality);
    size = getCompressedSizeKB(result);

    // Close enough (±10%)
    if (Math.abs(size - targetSizeKB) / targetSizeKB < 0.1) break;
  }

  return result;
}

/**
 * Enhanced image compression with smart optimization
 */
export function compressFile(file: File, options: CompressionOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context not available');
        }

        // Configuration with defaults
        const config = {
          maxWidth: 1000,
          maxHeight: 1000,
          quality: undefined, // Will be set adaptively
          format: checkWebPSupport() ? 'webp' : 'jpeg',
          progressive: true,
          targetSizeKB: 300,
          ...options
        };

        // Calculate scaling
        const scale = Math.min(
          config.maxWidth / img.width,
          config.maxHeight / img.height,
          1
        );

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Analyze image complexity for quality optimization
        const complexity = analyzeImageComplexity(canvas);
        const quality = config.quality ??
          getAdaptiveQuality(complexity, config.targetSizeKB);

        // Compress to target size
        const result = compressToTargetSize(canvas, config.format as 'jpeg' | 'webp', config.targetSizeKB);

        resolve(result);
        URL.revokeObjectURL(url);

      } catch (error) {
        URL.revokeObjectURL(url);
        reject(new Error(`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use compressFile with options instead
 */
export function compressFileLegacy(file: File): Promise<string> {
  return compressFile(file, {
    maxWidth: 1000,
    maxHeight: 1000,
    quality: 0.8,
    format: 'jpeg',
    progressive: false,
    targetSizeKB: 500
  });
}
