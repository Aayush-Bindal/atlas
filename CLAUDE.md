# CLAUDE.md

_ATLAS MVP Developer Bible_
_Last updated: 2025-11-22_

**Current Status**: MVP with metadata extraction, enhanced prompts, and frontend integration helpers

---

## 0. GOLDEN RULES (read aloud before touching code)

1. ** Stateless only ** – no DB, no disk, no Redis, no cookies.
2. ** 60 s hard wall ** – every code path must finish ≤ 60 s (Vercel maxDuration).
3. ** 50 MB wall ** – bodyParser sizeLimit already set; still keep memory low (compress on client).
4. ** One file, one prompt, one model ** – no fall-backs, no prompt folder, no A/B.
5. ** Log everything ** – stdout JSON so we can `jq` it in the dashboard.
6. ** Hackathon MVP ** – perfect is enemy of shipped; comments > abstraction.

---

## 1. STACK & MODELS

| Tier           | Tech                                                  | Model     | Reason                             |
| -------------- | ----------------------------------------------------- | --------- | ---------------------------------- |
| Frontend       | Next.js 14 (app router), React 18, TypeScript 5       | —         | Team knows it                      |
| Flipbook       | react-pageflip                                        | —         | Drop-in component                  |
| Image compress | Browser canvas + EXIF extraction                      | —         | Metadata + compression pipeline    |
| API runtime    | Vercel Serverless Function                            | —         | 1024 MB RAM, 60 s                  |
| Vision LLM     | **Claude 3.5 Sonnet** (`anthropic/claude-3.5-sonnet`) | 200 k ctx | High reasoning & prose quality     |
| Caption LLM    | **DeepSeek R1 Free** (`deepseek/deepseek-r1:free`)    | —         | Cost-effective, fast captions      |
| Gateway        | OpenRouter single key                                 | —         | One key in env, no rotation        |
| Metadata       | exifr + TypeScript                                    | —         | GPS, timestamp, device extraction  |
| API Client     | Axios + TypeScript                                    | —         | Type-safe HTTP with error handling |
| Workflow       | State management + progress tracking                  | —         | Orchestrated user experience       |

---

## 2. API CONTRACTS

| Method | Route          | Purpose              | Input                                   | Output                                  |
| ------ | -------------- | -------------------- | --------------------------------------- | --------------------------------------- |
| `POST` | `/api/caption` | Generate AI captions | `{image: ImageUpload}`                  | `{orderIndex, caption}`                 |
| `POST` | `/api/atlas`   | Generate story       | `{images[], contexts[], globalAnswers}` | `{pages[]}`                             |
| `GET`  | `/api/health`  | Health check         | -                                       | `{status, timestamp, version, latency}` |

**Headers** `Content-Type: application/json`  
**Status** `200 / 400 / 413 / 502 / 504`

### Data Schemas

```typescript
interface ImageMetadata {
  takenAt?: string; // ISO 8601 timestamp
  latitude?: number; // Decimal degrees (-90 to 90)
  longitude?: number; // Decimal degrees (-180 to 180)
  device?: string; // Camera model/make
}

interface ImageUpload {
  orderIndex: number;
  base64: string;
  metadata?: ImageMetadata; // Optional EXIF metadata
}
```

### Caption Request/Response

```typescript
// POST /api/caption
{
  image: {
    orderIndex: 1,
    base64: "data:image/jpeg;base64,/9j/...",
    metadata: {
      takenAt: "2024-01-15T10:30:00.000Z",
      latitude: 40.7128,
      longitude: -74.0060,
      device: "iPhone 15 Pro"
    }
  }
}

// Response
{
  orderIndex: 1,
  caption: "A person standing in front of a landmark building"
}
```

### Story Request/Response

```typescript
// POST /api/atlas
{
  images: [
    {
      orderIndex: 1,
      base64: "data:image/jpeg;base64,/9j/...",
      metadata: { takenAt: "2024-01-15T10:30:00.000Z", ... }
    }
  ],
  contexts: [
    { orderIndex: 1, text: "Alice holding the golden ticket" }
  ],
  globalAnswers: {
    purpose: "Birthday weekend in Tokyo",
    mood: "whimsical & nostalgic"
  }
}

// Response
{
  pages: [
    { orderIndex: 1, narrativeText: "The weekend began as soon as Alice clutched the golden ticket..." }
  ]
}
```

### Health Check

```typescript
// GET /api/health
{
  status: "ok",
  timestamp: "2024-01-15T10:30:00.000Z",
  version: "1.0.0",
  openRouterLatencyMs: 150
}
```

### Error Responses

```typescript
{ error: "VALIDATION_ERROR", message: "Invalid image format" }
{ error: "OPENROUTER_ERROR", message: "Upstream timeout after 45s" }
{ error: "ATLAS_API_ERROR", message: "Caption generation failed" }
```

---

## 3. PROMPT TEMPLATES

### Caption Generation Prompt (`lib/prompts/caption.ts`)

```typescript
export const CAPTION_SYSTEM = `You are an expert photo analyst. Provide a concise, factual description that captures:
- Main subjects and their actions
- Setting and environment details
- Key objects and visual elements
- Time of day and lighting conditions (if apparent)

Keep descriptions objective and focus on observable details. Avoid assumptions about emotions or relationships.`;

export function buildCaptionPrompt(
  base64: string,
  metadata?: ImageMetadata,
): string {
  let context = "";
  if (metadata?.device) {
    context = `Photo taken with ${metadata.device}. `;
  }

  return `${context}${CAPTION_SYSTEM}\n\n<image>${base64}</image>`;
}
```

### Story Generation Prompt (`lib/prompts/story.ts`)

```typescript
export const STORY_SYSTEM = `You are a master storyteller creating vivid, engaging narratives from photo sequences.

STORYTELLING PRINCIPLES:
- Weave photos into a cohesive, chronological story
- Use rich, descriptive language that brings scenes to life
- Incorporate location and temporal context naturally
- Create emotional connections between moments
- Maintain consistent tone and pacing
- Reference specific details from captions and metadata

OUTPUT FORMAT: Valid JSON only
{"pages":[{"orderIndex":1,"narrativeText":"Story text here..."}]}`;

export function buildStoryPrompt(
  images: { orderIndex: number; base64: string; metadata?: ImageMetadata }[],
  contexts: { orderIndex: number; text: string }[],
  globalAnswers: Record<string, string>,
): string {
  // Enhanced global context
  const globalContext = buildGlobalContext(globalAnswers);

  // Enhanced photo descriptions with metadata
  const photoDescriptions = images
    .map((img) => {
      const caption =
        contexts.find((c) => c.orderIndex === img.orderIndex)?.text || "";
      const metadataContext = buildMetadataContext(img.metadata);

      return `Photo ${img.orderIndex}: ${caption}${metadataContext}
<image>${img.base64}</image>`;
    })
    .join("\n\n");

  return `${STORY_SYSTEM}\n\nGLOBAL CONTEXT:\n${globalContext}\n\nPHOTO SEQUENCE:\n${photoDescriptions}\n\nCreate the story:`;
}

function buildGlobalContext(answers: Record<string, string>): string {
  const { purpose, mood, ...other } = answers;
  return `Event: ${purpose || "Special occasion"}
Mood: ${mood || "Joyful and memorable"}
Additional details: ${Object.entries(other)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ")}`;
}

function buildMetadataContext(metadata?: ImageMetadata): string {
  if (!metadata) return "";

  const parts = [];
  if (metadata.takenAt) {
    const date = new Date(metadata.takenAt);
    parts.push(`taken ${date.toLocaleDateString()}`);
  }
  if (metadata.latitude && metadata.longitude) {
    parts.push(
      `at coordinates ${metadata.latitude.toFixed(4)}, ${metadata.longitude.toFixed(4)}`,
    );
  }
  if (metadata.device) {
    parts.push(`captured with ${metadata.device}`);
  }

  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}
```

**Token math**: 10 img × ~200 tokens caption + 800 prompt + 400 global + 200 metadata ≈ 3.6 k → 196.4 k free.

---

## 4. FRONTEND INTEGRATION

### Quick Start Example

```typescript
import { AtlasWorkflow } from '@/lib/utils/workflow';

function AtlasApp() {
  const [workflow] = useState(() => new AtlasWorkflow());
  const [state, setState] = useState(workflow.getState());

  useEffect(() => {
    return workflow.subscribe(setState);
  }, [workflow]);

  const handleFileUpload = async (files: File[]) => {
    try {
      await workflow.processFiles(files);
      await workflow.generateCaptions();
      await workflow.generateStory();
    } catch (error) {
      console.error('Workflow failed:', error);
    }
  };

  return (
    <div>
      {state.isProcessing && <div>Processing images...</div>}
      {state.story && <StoryDisplay story={state.story} />}
    </div>
  );
}
```

### Component Architecture

```typescript
// API Client
import { atlasAPI } from "@/lib/api/client";

// Image Processing
import { processImages } from "@/lib/utils/imagePipeline";

// Workflow Management
import { AtlasWorkflow } from "@/lib/utils/workflow";
```

### Error Handling

```typescript
import { AtlasAPIError } from "@/lib/api/client";

try {
  await workflow.processFiles(files);
} catch (error) {
  if (error instanceof AtlasAPIError) {
    // API-specific error
    showError(`API Error: ${error.message}`);
  } else {
    // General error
    showError(`Processing failed: ${error.message}`);
  }
}
```

### Progress Tracking

```typescript
workflow.subscribe((state) => {
  if (state.progress.imagesProcessed < state.progress.totalImages) {
    updateProgress(
      "Processing images...",
      state.progress.imagesProcessed / state.progress.totalImages,
    );
  }
  if (state.isGeneratingCaptions) {
    updateProgress("Generating captions...");
  }
  if (state.isGeneratingStory) {
    updateProgress("Creating your story...");
  }
});
```

---

## 5. CODE SNAPSHOTS

### 5.1 API route `/api/atlas.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/openrouter";
import { STORY_MODEL } from "../../../lib/config/models";
import { buildStoryPrompt } from "../../../lib/prompts/story";
import { StoryRequest, StoryResponse } from "../../../lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Log incoming request
    console.log(`[${requestId}] STORY REQUEST:`, {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    const body: StoryRequest = await req.json();
    const { images, contexts, globalAnswers } = body;

    console.log(`[${requestId}] STORY REQUEST BODY:`, {
      imageCount: images.length,
      captionCount: contexts.length,
      globalAnswers: {
        purpose: globalAnswers.purpose,
        mood: globalAnswers.mood,
        additionalKeys: Object.keys(globalAnswers).filter(
          (k) => !["purpose", "mood"].includes(k),
        ),
      },
    });

    const prompt = buildStoryPrompt(images, contexts, globalAnswers);
    console.log(`[${requestId}] STORY PROMPT BUILT:`, {
      promptLength: prompt.length,
      model: STORY_MODEL.name,
      imageCount: images.length,
    });

    const client = createClient(STORY_MODEL.timeout);
    const res = await client.post("/chat/completions", {
      model: STORY_MODEL.name,
      messages: [{ role: "user", content: prompt }],
      temperature: STORY_MODEL.temperature,
      max_tokens: STORY_MODEL.maxTokens,
    });

    const raw = res.data.choices[0].message.content;
    const json = JSON.parse(raw);
    const response: StoryResponse = { pages: json.pages };

    const duration = Date.now() - startTime;

    // Log successful response
    console.log(`[${requestId}] STORY RESPONSE:`, {
      pageCount: json.pages?.length || 0,
      duration,
      model: STORY_MODEL.name,
      status: "success",
    });

    return NextResponse.json(response);
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Log error response
    console.error(`[${requestId}] STORY ERROR:`, {
      error: err.message,
      stack: err.stack,
      duration,
      model: STORY_MODEL.name,
      status: "error",
    });

    return NextResponse.json(
      { error: "OPENROUTER_ERROR", message: err.message },
      { status: 502 },
    );
  }
}
```

### 5.2 API route `/api/caption.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/openrouter";
import { CAPTION_MODEL } from "../../../lib/config/models";
import { buildCaptionPrompt } from "../../../lib/prompts/caption";
import { CaptionRequest, CaptionResponse } from "../../../lib/types";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Log incoming request
    console.log(`[${requestId}] CAPTION REQUEST:`, {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString(),
    });

    const body: CaptionRequest = await req.json();
    const { image } = body;

    console.log(`[${requestId}] CAPTION REQUEST BODY:`, {
      orderIndex: image.orderIndex,
      hasMetadata: !!image.metadata,
      base64Length: image.base64.length,
      metadata: image.metadata
        ? {
            hasTimestamp: !!image.metadata.takenAt,
            hasLocation: !!(
              image.metadata.latitude && image.metadata.longitude
            ),
            device: image.metadata.device,
          }
        : null,
    });

    const prompt = buildCaptionPrompt(image.base64, image.metadata);
    console.log(`[${requestId}] CAPTION PROMPT BUILT:`, {
      promptLength: prompt.length,
      model: CAPTION_MODEL.name,
      orderIndex: image.orderIndex,
    });

    const client = createClient(CAPTION_MODEL.timeout);
    const res = await client.post("/chat/completions", {
      model: CAPTION_MODEL.name,
      messages: [
        {
          role: "system",
          content:
            "You are an objective scene describer. Reply with one concise sentence listing visible subjects, actions, setting, and key objects.",
        },
        { role: "user", content: prompt },
      ],
      temperature: CAPTION_MODEL.temperature,
      max_tokens: CAPTION_MODEL.maxTokens,
    });

    const caption = res.data.choices[0].message.content.trim();
    const response: CaptionResponse = { orderIndex: image.orderIndex, caption };

    const duration = Date.now() - startTime;

    // Log successful response
    console.log(`[${requestId}] CAPTION RESPONSE:`, {
      orderIndex: image.orderIndex,
      captionLength: caption.length,
      duration,
      model: CAPTION_MODEL.name,
      status: "success",
    });

    return NextResponse.json(response);
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Log error response
    console.error(`[${requestId}] CAPTION ERROR:`, {
      error: err.message,
      stack: err.stack,
      duration,
      model: CAPTION_MODEL.name,
      status: "error",
    });

    return NextResponse.json(
      { error: "OPENROUTER_ERROR", message: err.message },
      { status: 502 },
    );
  }
}
```

### 5.3 Client compressor (`lib/utils/compress.ts`)

```typescript
export function compressFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 1000;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => reject(new Error("compress fail"));
    img.src = url;
  });
}
```

### 5.4 Metadata extraction (`lib/utils/extractMetadata.ts`)

```typescript
import { parse } from "exifr";

export interface ImageMetadata {
  takenAt?: string;
  latitude?: number;
  longitude?: number;
  device?: string;
}

export async function extractMetadata(file: File): Promise<ImageMetadata> {
  try {
    const exif = await parse(file, {
      pick: [
        "DateTimeOriginal",
        "GPSLatitude",
        "GPSLongitude",
        "Make",
        "Model",
      ],
    });

    if (!exif) return {};

    const metadata: ImageMetadata = {};

    if (exif.DateTimeOriginal) {
      const date = new Date(exif.DateTimeOriginal);
      if (!isNaN(date.getTime())) {
        metadata.takenAt = date.toISOString();
      }
    }

    if (exif.GPSLatitude !== undefined && exif.GPSLongitude !== undefined) {
      metadata.latitude = exif.GPSLatitude;
      metadata.longitude = exif.GPSLongitude;
    }

    if (exif.Make || exif.Model) {
      const make = exif.Make ? exif.Make.trim() : "";
      const model = exif.Model ? exif.Model.trim() : "";
      metadata.device = [make, model].filter(Boolean).join(" ").trim();
    }

    return metadata;
  } catch (error) {
    console.warn("Failed to extract EXIF metadata:", error);
    return {};
  }
}
```

### 5.5 API Client (`lib/api/client.ts`)

```typescript
import axios, { AxiosInstance, AxiosError } from "axios";

export class AtlasAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any,
  ) {
    super(message);
    this.name = "AtlasAPIError";
  }
}

export class AtlasAPI {
  private client: AxiosInstance;

  constructor(baseURL = "/api") {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { "Content-Type": "application/json" },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data as any;
          if (data?.error) {
            throw new AtlasAPIError(data.message || data.error, status, data);
          }
          throw new AtlasAPIError(
            `Request failed with status ${status}`,
            status,
            data,
          );
        }
        if (error.request) {
          throw new AtlasAPIError(
            "Network error - please check your connection",
          );
        }
        throw new AtlasAPIError(error.message || "Unknown error occurred");
      },
    );
  }

  async generateCaption(imageData: ImageUpload): Promise<CaptionResponse> {
    const request: CaptionRequest = { image: imageData };
    const response = await this.client.post<CaptionResponse>(
      "/caption",
      request,
    );
    return response.data;
  }

  async generateCaptions(images: ImageUpload[]): Promise<CaptionResponse[]> {
    const promises = images.map((img) => this.generateCaption(img));
    return Promise.all(promises);
  }

  async generateStory(request: StoryRequest): Promise<StoryResponse> {
    const response = await this.client.post<StoryResponse>("/atlas", request);
    return response.data;
  }

  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>("/health");
    return response.data;
  }
}

export const atlasAPI = new AtlasAPI();
```

### 5.6 Workflow Orchestrator (`lib/utils/workflow.ts`)

```typescript
import { atlasAPI, AtlasAPIError } from "../api/client";
import { processImages, ProcessedImage } from "./imagePipeline";
import {
  ImageUpload,
  ValidatedCaption,
  GlobalAnswers,
  StoryResponse,
} from "../types";

export interface WorkflowState {
  images: ProcessedImage[];
  captions: ValidatedCaption[];
  globalAnswers: GlobalAnswers;
  story?: StoryResponse;
  isProcessing: boolean;
  isGeneratingCaptions: boolean;
  isGeneratingStory: boolean;
  error?: string;
  progress: {
    imagesProcessed: number;
    totalImages: number;
    captionsGenerated: number;
  };
}

export class AtlasWorkflow {
  private state: WorkflowState = {
    images: [],
    captions: [],
    globalAnswers: { purpose: "", mood: "" },
    isProcessing: false,
    isGeneratingCaptions: false,
    isGeneratingStory: false,
    progress: { imagesProcessed: 0, totalImages: 0, captionsGenerated: 0 },
  };

  private listeners: ((state: WorkflowState) => void)[] = [];

  subscribe(listener: (state: WorkflowState) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  async processFiles(files: File[]): Promise<void> {
    this.state.isProcessing = true;
    this.state.error = undefined;
    this.state.progress.totalImages = files.length;
    this.notifyListeners();

    try {
      this.state.images = await processImages(files, (completed) => {
        this.state.progress.imagesProcessed = completed;
        this.notifyListeners();
      });
    } catch (error) {
      this.state.error =
        error instanceof Error ? error.message : "Failed to process images";
      throw error;
    } finally {
      this.state.isProcessing = false;
      this.notifyListeners();
    }
  }

  async generateCaptions(): Promise<void> {
    if (this.state.images.length === 0) return;

    this.state.isGeneratingCaptions = true;
    this.state.error = undefined;
    this.state.progress.captionsGenerated = 0;
    this.notifyListeners();

    try {
      const imageUploads: ImageUpload[] = this.state.images.map((img) => ({
        orderIndex: img.orderIndex,
        base64: img.base64,
        metadata: img.metadata,
      }));

      const captionResponses = await atlasAPI.generateCaptions(imageUploads);
      this.state.captions = captionResponses.map((response) => ({
        orderIndex: response.orderIndex,
        text: response.caption,
      }));
      this.state.progress.captionsGenerated = this.state.captions.length;
    } catch (error) {
      this.state.error =
        error instanceof AtlasAPIError
          ? `Caption generation failed: ${error.message}`
          : "Failed to generate captions";
      throw error;
    } finally {
      this.state.isGeneratingCaptions = false;
      this.notifyListeners();
    }
  }

  async generateStory(): Promise<void> {
    if (this.state.images.length === 0 || this.state.captions.length === 0)
      return;

    this.state.isGeneratingStory = true;
    this.state.error = undefined;
    this.notifyListeners();

    try {
      const request: StoryRequest = {
        images: this.state.images.map((img) => ({
          orderIndex: img.orderIndex,
          base64: img.base64,
          metadata: img.metadata,
        })),
        contexts: this.state.captions,
        globalAnswers: this.state.globalAnswers,
      };

      this.state.story = await atlasAPI.generateStory(request);
    } catch (error) {
      this.state.error =
        error instanceof AtlasAPIError
          ? `Story generation failed: ${error.message}`
          : "Failed to generate story";
      throw error;
    } finally {
      this.state.isGeneratingStory = false;
      this.notifyListeners();
    }
  }

  setGlobalAnswers(answers: GlobalAnswers): void {
    this.state.globalAnswers = answers;
    this.notifyListeners();
  }

  getState(): WorkflowState {
    return { ...this.state };
  }
  reset(): void {
    this.state = {
      images: [],
      captions: [],
      globalAnswers: { purpose: "", mood: "" },
      isProcessing: false,
      isGeneratingCaptions: false,
      isGeneratingStory: false,
      progress: { imagesProcessed: 0, totalImages: 0, captionsGenerated: 0 },
    };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }
}
```

---

## 6. LOG SCHEMA (stdout JSON)

All logs use Next.js built-in console logging with structured JSON output and request IDs for tracing.

**Request Logging Format:**

```json
{
  "requestId": "uuid-v4",
  "endpoint": "CAPTION/STORY/HEALTH REQUEST",
  "method": "POST/GET",
  "url": "full-request-url",
  "headers": { "content-type": "application/json", ... },
  "timestamp": "2025-11-21T21:46:05.039Z"
}
```

**Response Logging Format:**

```json
{
  "requestId": "uuid-v4",
  "endpoint": "CAPTION/STORY/HEALTH RESPONSE",
  "orderIndex": 1,
  "captionLength": 45,
  "pageCount": 10,
  "duration": 2500,
  "model": "deepseek/deepseek-r1:free",
  "status": "success"
}
```

**Error Logging Format:**

```json
{
  "requestId": "uuid-v4",
  "endpoint": "CAPTION/STORY ERROR",
  "error": "OpenRouter timeout",
  "stack": "error-stack-trace",
  "duration": 45000,
  "model": "anthropic/claude-3.5-sonnet",
  "status": "error"
}
```

Filter logs with jq:

```bash
# Story generation events
vercel logs | jq '. | select(.endpoint=="STORY RESPONSE") | {duration,pageCount,model}'

# Caption generation events
vercel logs | jq '. | select(.endpoint=="CAPTION RESPONSE") | {orderIndex,captionLength,duration}'

# Error events
vercel logs | jq '. | select(.status=="error") | {endpoint,error,duration}'

# Trace specific request
vercel logs | jq '. | select(.requestId=="your-uuid-here")'
```

---

## 7. ERROR TAXONOMY

| Code              | HTTP | Meaning     | User message                            |
| ----------------- | ---- | ----------- | --------------------------------------- |
| VALIDATION_ERROR  | 400  | Zod failed  | "Please check photo order & captions."  |
| PAYLOAD_TOO_LARGE | 413  | > 50 MB     | "Photos too large after compression."   |
| OPENROUTER_ERROR  | 502  | Timeout/5xx | "AI service hiccup, try again in 30 s." |
| ATLAS_API_ERROR   | 502  | API failed  | "Caption generation failed."            |
| UNKNOWN           | 500  | Uncaught    | "Server error, we’ve been notified."    |

---

## 8. COST QUICK MATH (Claude 3.5 Sonnet via OpenRouter)

- **Caption Generation**: 10 × ~200 tokens × $0 (free with DeepSeek) = $0.00
- **Story Generation**: ~3,000 tokens × $0.003/1k = $0.009
- **Total / story ≈ $0.01** → 1,000 demos = $10

**Model Cost Comparison:**
| Use Case | Model | Cost | Speed | Quality |
|----------|-------|------|-------|---------|
| Captions | `deepseek/deepseek-r1:free` | Free | Fast | Good |
| Captions | `google/gemini-flash-1.5` | $0.0004/1k | Fast | Good |
| Story | `anthropic/claude-3.5-sonnet` | $0.003/1k | High | Excellent |
| Story | `openai/gpt-4o` | $0.005/1k | High | Excellent |

---

## 9. TEST CHECKLIST

- [x] Unit: 5-img payload → parses & returns 5 pages
- [x] Unit: 15-img payload → token count ≤ 8 k
- [x] Unit: malformed base64 → 400
- [x] Unit: EXIF metadata extraction → GPS, timestamp, device
- [x] Integration: API client → proper error handling
- [x] Integration: Workflow orchestrator → state management
- [x] Load: k6 spike 20 RPS cold → p95 < 55 s
- [x] Memory: 15 full-res images → local RSS < 400 MB

---

## 10. VERCEL.JSON

```json
{
  "functions": {
    "app/api/atlas/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

---

## 11. ENV VARS (add in Vercel dashboard)

```
# Required
OPENROUTER_KEY=sk-or-v1-...

# Optional - Model Selection
CAPTION_MODEL=deepseek/deepseek-r1:free
STORY_MODEL=anthropic/claude-3.5-sonnet

# Optional - Logging
LOG_LEVEL=info

# Optional - Deployment
VERCEL_URL=https://your-app.vercel.app
```

---

## 12. DEPLOY WITHOUT BRAKE

```bash
npm i
npm run build
npm run test
git add .
git commit -m "feat: metadata extraction + enhanced prompts + frontend integration"
git push origin main
# Vercel auto-builds → check function logs
```

---

## 13. FUTURE HOOKS (don't code yet, just reserved keys)

- `audioUrl` – TTS mp3 per page
- `title` – chapter title
- `language` – ISO 639-1

---

**Now go ship the flipbook.**
