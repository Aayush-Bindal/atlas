# CLAUDE.md

_Claude-specific dev-bible for ATLAS MVP_  
_Last updated: 2025-11-22_

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

| Tier           | Tech                                                  | Model     | Reason                              |
| -------------- | ----------------------------------------------------- | --------- | ----------------------------------- |
| Frontend       | Next.js 14 (app router), React 18, TypeScript 5       | —         | Team knows it                       |
| Flipbook       | react-pageflip                                        | —         | Drop-in component                   |
| Image compress | Browser canvas                                        | —         | Zero deps, 30 LOC                   |
| API runtime    | Vercel Serverless Function                            | —         | 1024 MB RAM, 60 s                   |
| Vision LLM     | **Claude 3.5 Sonnet** (`anthropic/claude-3.5-sonnet`) | 200 k ctx | Best reasoning & prose at hackathon |
| Gateway        | OpenRouter single key                                 | —         | One key in env, no rotation         |

---

## 2. SINGLE API CONTRACT

**Endpoint** `POST https://<host>/api/atlas`  
**Headers** `Content-Type: application/json`  
**Status** `200 / 400 / 413 / 502 / 504`

### Request

```typescript
{
  images: [                          // exact order 1..N
    { orderIndex: 1, base64: "data:image/jpeg;base64,/9j/..." },
    ...
  ],
  contexts: [                        // user-edited captions
    { orderIndex: 1, text: "Alice holding the golden ticket" },
    ...
  ],
  globalAnswers: {                   // raw from Host Questions
    purpose: "Birthday weekend in Tokyo",
    mood: "whimsical & nostalgic",
    ...
  }
}
```

### Response (success 200)

```typescript
{ pages: [
    { orderIndex: 1, narrativeText: "The weekend began as soon as Alice clutched the golden ticket..." },
    ...
] }
```

### Response (error)

```typescript
{ error: "OPENROUTER_ERROR", message: "Upstream timeout after 45 s" }
```

---

## 3. PROMPT TEMPLATE (inline string in `prompt.ts`)

```plaintext
You are a nostalgic storyteller creating a single continuous past-tense narrative that connects every photo into a cohesive chaptered story.

Rules:
- Use only the verified captions provided; never invent names, places, or objects.
- Keep an upbeat, whimsical tone.
- Output ONLY valid JSON: {"pages":[{"orderIndex":1,"narrativeText":"..."},...]}

Global context:
purpose: {purpose}
mood: {mood}
other: {globalAnswers}

Now the photos with verified captions:
{imageLoop: "orderIndex X: base64 image, verifiedCaption: ..."}

Go!
```

**Token math**: 10 img × ~200 tokens caption + 600 prompt + 400 global ≈ 3 k → 197 k free.

---

## 4. CODE SNAPSHOTS

### 4.1 API route `/api/atlas.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import axios from "axios";
import { buildPrompt, countTokens } from "@/lib/prompt";
import { logger } from "@/lib/logger";

export const config = {
  api: { bodyParser: { sizeLimit: "50mb" } },
};

const ReqSchema = z.object({
  images: z
    .array(
      z.object({
        orderIndex: z.number().int().positive(),
        base64: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/),
      }),
    )
    .min(1)
    .max(15),
  contexts: z.array(
    z.object({
      orderIndex: z.number().int().positive(),
      text: z.string().min(1).max(500),
    }),
  ),
  globalAnswers: z.record(z.string()),
});

type Data =
  | { pages: { orderIndex: number; narrativeText: string }[] }
  | { error: string; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  if (req.method !== "POST")
    return res
      .status(405)
      .json({ error: "METHOD_NOT_ALLOWED", message: "POST only" });
  const parse = ReqSchema.safeParse(req.body);
  if (!parse.success)
    return res
      .status(400)
      .json({ error: "VALIDATION_ERROR", message: parse.error.message });

  const { images, contexts, globalAnswers } = parse.data;
  const prompt = buildPrompt(images, contexts, globalAnswers);
  const tok = countTokens(prompt);
  logger.info({ tok, images: images.length }, "prompt built");

  try {
    const OR_KEY = process.env.OPENROUTER_KEY!;
    const resp = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.75,
      },
      {
        headers: {
          Authorization: `Bearer ${OR_KEY}`,
          "HTTP-Referer": "https://github.com/your-org/atlas-mvp",
          "X-Title": "ATLAS",
        },
        timeout: 45000, // leave 15 s slack
      },
    );
    const raw = resp.data.choices[0].message.content;
    const json = JSON.parse(raw);
    logger.info({ pages: json.pages.length }, "story generated");
    return res.status(200).json({ pages: json.pages });
  } catch (err: any) {
    logger.error({ err: err.message });
    return res
      .status(502)
      .json({ error: "OPENROUTER_ERROR", message: err.message });
  }
}
```

### 4.2 Client compressor (`compress.ts`)

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

### 4.3 Token counter (`prompt.ts`)

```typescript
import { encode } from "gpt-tokenizer"; // cheap & fast

export function countTokens(text: string): number {
  return encode(text).length;
}

export function buildPrompt(
  images: { orderIndex: number; base64: string }[],
  contexts: { orderIndex: number; text: string }[],
  globalAnswers: Record<string, string>,
): string {
  const globalStr = Object.entries(globalAnswers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const parts: string[] = [
    `You are a nostalgic storyteller... (see §3 full prompt)`,
    `Global context:\n${globalStr}`,
    "Now the photos with verified captions:",
  ];
  const map = new Map(contexts.map((c) => [c.orderIndex, c.text]));
  for (const img of images.sort((a, b) => a.orderIndex - b.orderIndex)) {
    const cap = map.get(img.orderIndex) || "";
    parts.push(
      `orderIndex ${img.orderIndex}: base64 image, verifiedCaption: ${cap}`,
    );
  }
  parts.push("Go!");
  return parts.join("\n");
}
```

---

## 5. LOG SCHEMA (stdout JSON)

```json
{
  "level": 30,
  "time": 1732294954000,
  "msg": "story generated",
  "tok": 3150,
  "images": 10,
  "pages": 10,
  "latency": 12894
}
```

Use `jq` in Vercel log drain:  
`vercel logs my-app | jq '. | select(.msg=="story generated") | {latency,pages}'`

---

## 6. ERROR TAXONOMY

| Code              | HTTP | Meaning     | User message                            |
| ----------------- | ---- | ----------- | --------------------------------------- |
| VALIDATION_ERROR  | 400  | Zod failed  | "Please check photo order & captions."  |
| PAYLOAD_TOO_LARGE | 413  | > 50 MB     | "Photos too large after compression."   |
| OPENROUTER_ERROR  | 502  | Timeout/5xx | "AI service hiccup, try again in 30 s." |
| UNKNOWN           | 500  | Uncaught    | "Server error, we’ve been notified."    |

---

## 7. COST QUICK MATH (Claude 3.5 Sonnet via OpenRouter)

- Input: 3 k tokens × $3.00 / 1 M = 0.9 ¢
- Output: ~600 tokens × $15.00 / 1 M = 0.9 ¢
- **Total / story ≈ 1.8 ¢** → 1 000 demos = $18

---

## 8. TEST CHECKLIST

- [ ] Unit: 5-img payload → parses & returns 5 pages
- [ ] Unit: 15-img payload → token count ≤ 8 k
- [ ] Unit: malformed base64 → 400
- [ ] Load: k6 spike 20 RPS cold → p95 < 55 s
- [ ] Memory: 15 full-res images → local RSS < 400 MB

---

## 9. VERCEL.JSON

```json
{
  "functions": {
    "pages/api/atlas.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

---

## 10. ENV VARS (add in Vercel dashboard)

```
OPENROUTER_KEY=sk-or-v1-...
```

---

## 11. DEPLOY WITHOUT BRAKE

```bash
npm i
npm run build
npm run test
git add .
git commit -m "mvp backend"
git push origin main
# Vercel auto-builds → check function logs
```

---

## 12. FUTURE HOOKS (don’t code yet, just reserved keys)

- `audioUrl` – TTS mp3 per page
- `title` – chapter title
- `language` – ISO 639-1

---

**Now go ship the flipbook.**
