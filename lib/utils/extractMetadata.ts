import { parse } from 'exifr';

export interface ImageMetadata {
  takenAt?: string; // ISO 8601 timestamp
  latitude?: number; // Decimal degrees (-90 to 90)
  longitude?: number; // Decimal degrees (-180 to 180)
  device?: string; // Camera model/make
}

/**
 * Extract EXIF metadata from an image file
 * @param file - The image file to extract metadata from
 * @returns Promise resolving to extracted metadata
 */
export async function extractMetadata(file: File): Promise<ImageMetadata> {
  try {
    // Extract EXIF data using exifr
    const exif = await parse(file, {
      pick: ['DateTimeOriginal', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model']
    });

    if (!exif) {
      return {};
    }

    const metadata: ImageMetadata = {};

    // Extract timestamp
    if (exif.DateTimeOriginal) {
      try {
        // Convert EXIF timestamp to ISO string
        const date = new Date(exif.DateTimeOriginal);
        if (!isNaN(date.getTime())) {
          metadata.takenAt = date.toISOString();
        }
      } catch (e) {
        // Invalid date, skip
      }
    }

    // Extract GPS coordinates
    if (exif.GPSLatitude !== undefined && exif.GPSLongitude !== undefined) {
      metadata.latitude = exif.GPSLatitude;
      metadata.longitude = exif.GPSLongitude;
    }

    // Extract device information
    if (exif.Make || exif.Model) {
      const make = exif.Make ? exif.Make.trim() : '';
      const model = exif.Model ? exif.Model.trim() : '';
      metadata.device = [make, model].filter(Boolean).join(' ').trim();
    }

    return metadata;
  } catch (error) {
    // If EXIF extraction fails, return empty metadata
    // This ensures the app continues to work with images that don't have EXIF data
    console.warn('Failed to extract EXIF metadata:', error);
    return {};
  }
}