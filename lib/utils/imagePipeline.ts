import { extractMetadata, ImageMetadata } from "./extractMetadata";
import { compressFile } from "./compress";

export interface ProcessedImage {
  orderIndex: number;
  base64: string;
  metadata?: ImageMetadata;
  file: File;
}

/**
 * Complete image processing pipeline
 * Extracts metadata, compresses, and prepares for API
 */
export async function processImage(
  file: File,
  orderIndex: number,
): Promise<ProcessedImage> {
  try {
    // Extract metadata first (before compression to preserve EXIF)
    const metadata = await extractMetadata(file);

    // Compress image
    const base64 = await compressFile(file);

    return {
      orderIndex,
      base64,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      file,
    };
  } catch (error) {
    console.warn(`Failed to process image ${orderIndex}:`, error);
    // Fallback: compress without metadata
    try {
      const base64 = await compressFile(file);
      return {
        orderIndex,
        base64,
        file,
      };
    } catch (compressError) {
      throw new Error(
        `Failed to process image ${orderIndex}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

/**
 * Process multiple images in parallel with progress tracking
 */
export async function processImages(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
): Promise<ProcessedImage[]> {
  const total = files.length;
  let completed = 0;

  const promises = files.map(async (file, index) => {
    const result = await processImage(file, index + 1);
    completed++;
    onProgress?.(completed, total);
    return result;
  });

  return Promise.all(promises);
}

/**
 * Validate processed images before API submission
 */
export function validateProcessedImages(images: ProcessedImage[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (images.length === 0) {
    errors.push("No images provided");
  }

  if (images.length > 15) {
    errors.push("Maximum 15 images allowed");
  }

  images.forEach((img, index) => {
    if (!img.base64) {
      errors.push(`Image ${index + 1}: Missing base64 data`);
    }
    if (!img.base64.startsWith("data:image/")) {
      errors.push(`Image ${index + 1}: Invalid base64 format`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
