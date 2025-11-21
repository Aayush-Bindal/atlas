// Basic validation schemas - simplified for MVP

export interface ImageUpload {
  orderIndex: number;
  base64: string;
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
