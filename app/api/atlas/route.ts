import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/openrouter";
import { STORY_MODEL } from "@/lib/config/models";
import { buildStoryPrompt } from "@/lib/prompts/story";
import { StoryRequest, StoryResponse } from "@/lib/types";

export const maxDuration = 60;

/**
 * Strip markdown code fences from LLM responses
 * Handles: ```json\n{...}\n``` or ```\n{...}\n``` or just {...}
 */
function stripMarkdownCodeFences(text: string): string {
  // Remove ```json or ``` prefix and ``` suffix
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

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
      imagesMetadata: images.map((img, i) => ({
        index: i + 1,
        hasMetadata: !!img.metadata,
        metadata: img.metadata
          ? {
              hasTimestamp: !!img.metadata.takenAt,
              hasLocation: !!(img.metadata.latitude && img.metadata.longitude),
              device: img.metadata.device,
            }
          : null,
      })),
    });

    const prompt = buildStoryPrompt(images, contexts, globalAnswers);
    console.log(`[${requestId}] STORY PROMPT BUILT:`, {
      promptLength: prompt.length,
      model: STORY_MODEL.name,
      imageCount: images.length,
      captionCount: contexts.length,
    });

    const client = createClient(STORY_MODEL.timeout);
    const res = await client.post("/chat/completions", {
      model: STORY_MODEL.name,
      messages: [{ role: "user", content: prompt }],
      temperature: STORY_MODEL.temperature,
      max_tokens: STORY_MODEL.maxTokens,
    });

    const raw = res.data.choices[0].message.content;

    // Log raw response for debugging
    console.log(`[${requestId}] RAW LLM RESPONSE:`, {
      length: raw.length,
      preview: raw.substring(0, 200),
      hasCodeFence: raw.includes("```"),
    });

    // Strip markdown code fences if present
    const cleanedJson = stripMarkdownCodeFences(raw);

    console.log(`[${requestId}] CLEANED JSON:`, {
      length: cleanedJson.length,
      preview: cleanedJson.substring(0, 200),
    });

    const json = JSON.parse(cleanedJson);
    const response: StoryResponse = { pages: json.pages };

    const duration = Date.now() - startTime;

    // Log successful response
    console.log(`[${requestId}] STORY RESPONSE:`, {
      pageCount: json.pages?.length || 0,
      duration,
      model: STORY_MODEL.name,
      status: "success",
      responseSize: JSON.stringify(response).length,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    const duration = Date.now() - startTime;

    // Log error response with more details
    console.error(`[${requestId}] STORY ERROR:`, {
      error: err.message,
      errorType: err.constructor.name,
      stack: err.stack,
      duration,
      model: STORY_MODEL.name,
      status: "error",
    });

    // Determine appropriate status code
    const statusCode =
      err.response?.status || (err.message.includes("JSON") ? 502 : 502);

    return NextResponse.json(
      {
        error: "OPENROUTER_ERROR",
        message: err.message,
        model: STORY_MODEL.name,
      },
      { status: statusCode },
    );
  }
}
