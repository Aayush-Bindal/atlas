import { z } from "zod";

// Basic validation schemas - simplified for MVP

export interface ImageMetadata {
  takenAt?: string; // ISO 8601 timestamp
  latitude?: number; // Decimal degrees (-90 to 90)
  longitude?: number; // Decimal degrees (-180 to 180)
  device?: string; // Camera model/make
}

export interface ImageUpload {
  orderIndex: number;
  base64: string;
  metadata?: ImageMetadata; // Optional EXIF metadata
}

export interface ValidatedCaption {
  orderIndex: number;
  text: string;
}

export interface GlobalAnswers {
  purpose: string;
  mood: string;
  [key: string]: string;
}

export interface CaptionRequest {
  image: ImageUpload;
}

export interface CaptionResponse {
  orderIndex: number;
  caption: string;
}

export interface StoryRequest {
  images: ImageUpload[];
  contexts: ValidatedCaption[];
  globalAnswers: GlobalAnswers;
}

export interface StoryResponse {
  pages: {
    orderIndex: number;
    narrativeText: string;
    title?: string;
    audioUrl?: string;
  }[];
}

export interface HealthResponse {
  status: "ok";
  timestamp: string;
  version: string;
  openRouterLatencyMs: number;
}

// ---------- Zod validation schemas ----------
export const ImageMetadataSchema = z.object({
  takenAt: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  device: z.string().optional(),
});

export const ImageUploadSchema = z.object({
  orderIndex: z.number().int().positive(),
  base64: z.string(),
  metadata: ImageMetadataSchema.optional(),
});

export const ValidatedCaptionSchema = z.object({
  orderIndex: z.number().int().positive(),
  text: z.string().min(1).max(2000, "Caption too long"),
});

export const GlobalAnswersSchema = z.object({}).catchall(z.string());

export const CaptionRequestSchema = z.object({
  image: ImageUploadSchema,
});

export const StoryRequestSchema = z.object({
  images: ImageUploadSchema.array().min(1).max(15),
  contexts: ValidatedCaptionSchema.array().min(1).max(15),
  globalAnswers: GlobalAnswersSchema,
});
