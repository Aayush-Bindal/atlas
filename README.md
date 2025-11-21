# ATLAS MVP – README.md

_Turn chat chaos into a living legend, instantly._  
_Hackathon-ready, stateless, 60-second flipbook generator._

---

## 1. WHAT IS ATLAS?

A single-session web app that lets a **host** drop 5-15 photos, reorder them, validate AI-generated captions, and click **"Generate Story"** to receive a continuous, Claude-written, page-flippable digital diary.  
No accounts, no storage, no video—just **one JSON round-trip** and the book appears.

---

## 2. SYSTEM ARCHITECTURE (stateless slice)

```
┌------------------┐
│ Browser (React)  │  react-dropzone + canvas compressor
└------┬-----------┘
       │ POST /api/atlas
       ▼
┌------------------┐
│ Next.js API      │  1 req → Claude 3.5 Sonnet via OpenRouter
│ 60 s / 1024 MB   │  returns {pages:[{narrativeText}]}
└------┬-----------┘
       │ 200 / 502
       ▼
┌------------------┐
│ Flipbook UI      │  react-pageflip consumes {pages}
└------------------┘
```

---

## 3. UX FLOW (60-second promise)

1. **Drop & Order** – drag 5-15 JPEG/PNG (auto-compressed ≤ 1000 px)
2. **Context RAG** – AI captions appear; host edits names/places (anti-hallucination)
3. **Generate** – spinner for ≤ 45 s while API calls Claude
4. **Reveal** – instant flipbook; each page = photo + narrative text

---

## 4. NEXT.JS API ROUTES

| Method | Route                         | Purpose               | Payload In                              | Payload Out                            |
| ------ | ----------------------------- | --------------------- | --------------------------------------- | -------------------------------------- |
| `POST` | `/api/atlas` **(only route)** | Full story generation | `{images[],contexts[],globalAnswers{}}` | `{pages:[{orderIndex,narrativeText}]}` |

No other endpoints. Health check = `POST /api/atlas` with 1-img fixture.

---

## 5. MODEL & TOKENOMICS

- **Model**: `anthropic/claude-3.5-sonnet` via OpenRouter
- **Context**: 200 k tokens (we use ~3 k input + 0.6 k output)
- **Cost**: ≈ **1.8 ¢ per story** (input 3 k × $3 + output 0.6 k × $15)
- **Temperature**: 0.75 for creative but consistent prose

---

## 6. DATA SCHEMAS

### Request

```typescript
{
  "images": [
    { "orderIndex": 1, "base64": "data:image/jpeg;base64,/9j/..." }
  ],
  "contexts": [
    { "orderIndex": 1, "text": "Alice holding golden ticket" }
  ],
  "globalAnswers": {
    "purpose": "Birthday weekend in Tokyo",
    "mood": "whimsical"
  }
}
```

### Response (200)

```json
{
  "pages": [
    {
      "orderIndex": 1,
      "narrativeText": "The weekend began as soon as Alice clutched the golden ticket..."
    }
  ]
}
```

---

## 7. FRONTEND SNIPPETS

### Image compress (browser)

```typescript
import { compressFile } from "@/lib/compress";
const dataUrl = await compressFile(file); // ≤ 1000 px, JPEG 0.8
```

### Call API

```typescript
const res = await fetch("/api/atlas", {
  method: "POST",
  body: JSON.stringify({ images, contexts, globalAnswers }),
});
const { pages } = await res.json();
setPages(pages); // feed to <HTMLFlipBook>
```

---

## 9. LIMITS & GUARDRAILS

| Limit        | Value                | Where enforced         |
| ------------ | -------------------- | ---------------------- |
| Max images   | 15                   | Zod schema             |
| Max payload  | 50 MB                | `bodyParser.sizeLimit` |
| Max duration | 60 s                 | `vercel.json`          |
| Compression  | 1000 px longest edge | client canvas          |
| Token input  | soft 8 k             | `countTokens` logged   |

---

## 10. LOGS & DEBUG

All logs stdout JSON.  
Filter in Vercel:

```
.json | select(.msg=="story generated")
```

---
