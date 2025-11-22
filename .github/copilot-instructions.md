# ATLAS - AI Copilot Instructions

## Project Overview

**ATLAS** is a stateless, hackathon-ready Next.js app that transforms photo collections into AI-generated narrative flipbooks. It orchestrates vision LLMs via OpenRouter to caption images and weave them into cohesive stories—all in under 60 seconds, with zero persistence.

**Core Philosophy**: Stateless-first, speed-optimized, hackathon MVP. Perfect is the enemy of shipped. Comments over abstraction.

## Architecture & Data Flow

```
Browser → Image compression (≤1000px) → POST /api/caption (per image)
       → User validates captions → POST /api/atlas (full story)
       → Claude 3.5 Sonnet via OpenRouter → JSON pages → Flipbook UI
```

**Key Constraints**:

- **60s hard limit**: Vercel function timeout (`maxDuration: 60` in `/api/atlas/route.ts`)
- **No persistence**: No database, no disk, no cookies—purely stateless request/response
- **50MB payload limit**: Client-side compression handles this (`lib/utils/compress.ts`)
- **Single model per task**: No fallbacks or A/B testing—DeepSeek R1 Free for captions, Claude 3.5 Sonnet for stories

## Critical File Structure

```
app/api/
  atlas/route.ts       # Story generation endpoint (45s timeout, 1024MB RAM)
  caption/route.ts     # Image caption endpoint (10s timeout)
  health/route.ts      # OpenRouter latency check
  speech-to-text/      # DEPRECATED - OpenRouter doesn't support this (use Web Speech API instead)
lib/
  openrouter.ts        # Axios client factory with timeout/headers
  config/models.ts     # Environment-driven model selection (CAPTION_MODEL, STORY_MODEL)
  prompts/             # Prompt templates with metadata injection
  types.ts             # Re-exports from validation.ts
  utils/
    validation.ts      # Zod schemas + TypeScript interfaces
    logger.ts          # JSON console logger (use logger.info/error for all API routes)
    compress.ts        # Browser-side image compression (canvas, max 1000px)
    speechToText.ts    # Web Speech API wrapper (browser-native, no server required)
```

## Development Workflows

### Running locally

```bash
npm run dev              # Next.js dev server on :3000
npm run build            # TypeScript compilation check
npm run lint             # ESLint validation
```

### Environment variables (required)

```bash
OPENROUTER_KEY=sk-or-v1-...           # OpenRouter API key
CAPTION_MODEL=deepseek/deepseek-r1:free  # Fast, free captioning
STORY_MODEL=anthropic/claude-3.5-sonnet  # High-quality narrative
VERCEL_URL=https://your-app.vercel.app   # For OpenRouter HTTP-Referer
```

### Testing API routes

```bash
# Health check
curl http://localhost:3000/api/health

# Caption generation
curl -X POST http://localhost:3000/api/caption \
  -H "Content-Type: application/json" \
  -d '{"image":{"orderIndex":1,"base64":"data:image/jpeg;base64,..."}}'

# Story generation
curl -X POST http://localhost:3000/api/atlas \
  -H "Content-Type: application/json" \
  -d '{"images":[...],"contexts":[...],"globalAnswers":{"purpose":"Birthday","mood":"whimsical"}}'
```

### Request ID tracking

All API routes generate UUIDs for request tracking. Search logs by `[requestId]`:

```bash
npm run dev 2>&1 | grep "[abc-123-def]"  # Filter specific request
```

## Project-Specific Conventions

### 1. **Logging: JSON stdout only**

Always use `logger.info/error/warn` from `lib/utils/logger.ts`:

```typescript
logger.info({ route: "caption", orderIndex: 1 }, "Caption generated");
logger.error({ route: "story", error: err.message }, "Story failed");
```

**Why**: Structured logs can be piped to `jq` in production dashboards.

### 2. **Error handling: 502 for OpenRouter failures**

OpenRouter errors always return `502 Bad Gateway`:

```typescript
catch (err: any) {
  logger.error({ route: "atlas", error: err.message }, "OpenRouter failed");
  return NextResponse.json({ error: "OPENROUTER_ERROR", message: err.message }, { status: 502 });
}
```

**Why**: Distinguishes LLM provider issues from validation errors (400) or timeouts (504).

### 3. **Model configuration: Environment-driven**

Edit `lib/config/models.ts` to change models—never hardcode model names in routes:

```typescript
// lib/config/models.ts
export const STORY_MODEL = {
  name: process.env.STORY_MODEL || "anthropic/claude-3.5-sonnet",
  maxTokens: 4096,
  temperature: 0.75,
  timeout: 45000, // 45s for story generation
};
```

### 4. **Image metadata: EXIF extraction**

Use `lib/utils/extractMetadata.ts` (exifr) to extract GPS, timestamps, device info:

```typescript
const metadata: ImageMetadata = {
  takenAt: "2024-01-15T10:30:00.000Z", // ISO 8601
  latitude: 40.7128,
  longitude: -74.006,
  device: "iPhone 15 Pro",
};
```

**Metadata is injected into prompts** (`lib/prompts/story.ts`) to enhance narrative context.

### 5. **Prompt engineering: Multi-modal JSON responses**

All prompts return JSON. Example from `lib/prompts/story.ts`:

```typescript
const STORY_SYSTEM = `You are a master storyteller...
OUTPUT FORMAT: Valid JSON only
{"pages":[{"orderIndex":1,"narrativeText":"Story text here..."}]}`;
```

**Why**: Guarantees parseable responses; no regex scraping needed.

### 6. **Client-side compression: Browser canvas**

Frontend compresses images before upload (`lib/utils/compress.ts`):

```typescript
export function compressFile(file: File): Promise<string> {
  // Scales to max 1000px, 0.8 JPEG quality, returns base64 data URL
}
```

**Why**: Keeps payloads under 50MB; Vercel bodyParser limit already configured.

### 7. **Workflow orchestration: AtlasWorkflow class**

Use `lib/utils/workflow.ts` for multi-step UI state management:

```typescript
const workflow = useRef(new AtlasWorkflow()).current;

// Subscribe to state changes
useEffect(() => {
  const unsubscribe = workflow.subscribe((state) => {
    setWorkflowState(state);
  });
  return unsubscribe;
}, [workflow]);

// Execute pipeline
workflow.setGlobalAnswers({ purpose, mood });
await workflow.generateCaptions();
await workflow.generateStory();
```

**Why**: Centralizes processing logic, progress tracking, and error handling across the image → caption → story pipeline.

### 8. **Speech-to-text integration: Web Speech API**

Use `lib/utils/speechToText.ts` for voice context capture:

```typescript
const result = await speechToText({
  language: 'en-US',
  maxRecordingTime: 30,
  onRecordingStart: () => { /* UI feedback */ },
  onRecordingEnd: () => { /* UI feedback */ }
});
```

- **Browser-native only**: Uses Web Speech API (instant, free, no API costs)
- **OpenRouter doesn't support speech-to-text**: Previous fallback removed (OpenRouter API doesn't have `/audio/transcriptions`)
- **Browser support check**: Use `isWebSpeechSupported()` to verify availability
- **Context injection**: Pass `audioContext` in `CaptionRequest` to enhance image captions

### 9. **Image processing pipeline**

Always use `lib/utils/imagePipeline.ts` for file handling:

```typescript
const processedImages = await processImages(
  files,
  (completed, total) => { /* progress UI */ },
  { maxWidth: 1200, targetSizeKB: 300 }
);
```

Pipeline executes: EXIF extraction → compression → validation → base64 encoding.

## Integration Points

### OpenRouter API

- **Base URL**: `https://openrouter.ai/api/v1`
- **Authentication**: Bearer token in `Authorization` header
- **Headers**: Include `HTTP-Referer` (VERCEL_URL) and `X-Title: ATLAS` for OpenRouter tracking
- **Timeout strategy**: 10s for captions, 45s for stories (configured per model in `models.ts`)

### Frontend API Client

Use `lib/api/client.ts` (AtlasAPI class) for type-safe HTTP calls:

```typescript
const api = new AtlasAPI("/api");
const { caption } = await api.generateCaption(image);
const { pages } = await api.generateStory(images, contexts, globalAnswers);
```

Handles errors with `AtlasAPIError` for consistent error messaging.

## Performance Considerations

1. **Parallel caption generation**: Frontend can call `/api/caption` for multiple images concurrently (10s timeout each)
2. **Story generation bottleneck**: `/api/atlas` processes all images sequentially in one Claude request (~45s)
3. **Memory optimization**: Compress images client-side; server processes base64 strings in memory
4. **Vercel limits**: 1024MB RAM, 60s max duration (configured in `vercel.json`)
5. **Compression strategies**:
   - Progressive JPEG for gradual loading
   - `targetSizeKB` parameter ensures predictable payload sizes
   - Metadata extraction happens before compression to preserve EXIF
6. **Error recovery**: Image processing falls back to basic compression if EXIF extraction fails

## Common Patterns

### Adding a new API route

1. Create `app/api/<name>/route.ts`
2. Import types from `lib/types.ts`
3. Use `createClient()` from `lib/openrouter.ts`
4. Add structured logging with `logger`
5. Return `NextResponse.json()` with appropriate status codes

### Modifying prompt templates

1. Edit `lib/prompts/<caption|story>.ts`
2. Test with actual images via `curl` or frontend
3. Validate JSON parsing in route handler
4. Update `CLAUDE.md` documentation if behavior changes

### Swapping LLM models

1. Update environment variables: `CAPTION_MODEL`, `STORY_MODEL`
2. Adjust `maxTokens`/`temperature` in `lib/config/models.ts` if needed
3. Test latency—ensure story generation stays under 45s

### Debugging LLM responses

All API routes log comprehensive diagnostics:

```typescript
console.log(`[${requestId}] RAW LLM RESPONSE:`, {
  length: raw.length,
  firstChars: raw.substring(0, 200),
  model: res.data.model
});
```

Use `stripMarkdownCodeFences()` in routes to handle LLMs returning ` ```json\n{...}\n``` ` wrappers.

## UI/UX Patterns (app/create/page.tsx)

### Glassmorphism design system

```typescript
className="glass-panel rounded-4xl"  // Applied to main card containers
// CSS: backdrop-filter: blur(24px), rgba(0,0,0,0.3) background
```

### State-driven UI feedback

Show processing steps based on `WorkflowState`:

```typescript
if (workflowState.isProcessing) return 'Processing images...';
if (workflowState.isGeneratingCaptions) return 'Generating captions...';
if (workflowState.isGeneratingStory) return 'Creating your story...';
```

### Error display patterns

Type-categorized errors for better UX:

```typescript
setError({
  type: 'processing' | 'transcription' | 'api' | 'general',
  message: 'User-friendly message'
});
```

### Component reusability

Extract reusable aesthetic components (`ImmersiveBackground`, `Navigation`) to maintain visual consistency.

## References

- **Main docs**: `CLAUDE.md` (developer bible with full API contracts)
- **Backend status**: `BACKEND_IMPLEMENTATION.md` (implementation checklist)
- **Project README**: `README.md` (high-level architecture)
- **Type definitions**: `lib/utils/validation.ts` (Zod schemas + TS interfaces)
- **API postman collection**: `postman.json` (request examples)
