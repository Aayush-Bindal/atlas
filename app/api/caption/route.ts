import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/openrouter";
import { CAPTION_MODEL } from "@/lib/config/models";
import { buildCaptionPrompt } from "@/lib/prompts/caption";
import { CaptionRequest, CaptionResponse } from "@/lib/types";

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
    const { image, audioContext } = body;

    console.log(`[${requestId}] CAPTION REQUEST BODY:`, {
      orderIndex: image.orderIndex,
      hasMetadata: !!image.metadata,
      hasAudioContext: !!audioContext,
      audioContextLength: audioContext?.length || 0,
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

    const prompt = buildCaptionPrompt(image.base64, image.metadata, audioContext);
    console.log(`[${requestId}] CAPTION PROMPT BUILT:`, {
      promptLength: prompt.length,
      model: CAPTION_MODEL.name,
      orderIndex: image.orderIndex,
    });

    const client = createClient(CAPTION_MODEL.timeout);

    console.log(`[${requestId}] SENDING TO OPENROUTER:`, {
      model: CAPTION_MODEL.name,
      temperature: CAPTION_MODEL.temperature,
      maxTokens: CAPTION_MODEL.maxTokens,
      promptLength: prompt.length,
    });

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

    console.log(`[${requestId}] OPENROUTER RESPONSE:`, {
      status: res.status,
      statusText: res.statusText,
      model: res.data.model,
      hasChoices: !!res.data.choices,
      choicesLength: res.data.choices?.length,
      firstChoice: res.data.choices?.[0]
        ? {
            role: res.data.choices[0].message?.role,
            contentLength: res.data.choices[0].message?.content?.length,
            finishReason: res.data.choices[0].finish_reason,
          }
        : null,
      usage: res.data.usage,
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

    // Log detailed error response
    console.error(`[${requestId}] CAPTION ERROR:`, {
      error: err.message,
      statusCode: err.response?.status,
      statusText: err.response?.statusText,
      responseData: err.response?.data,
      headers: err.response?.headers,
      duration,
      model: CAPTION_MODEL.name,
      status: "error",
    });

    // Return detailed error info
    const statusCode = err.response?.status || 502;
    return NextResponse.json(
      {
        error: "OPENROUTER_ERROR",
        message: err.message,
        details: err.response?.data,
        statusCode: err.response?.status,
        model: CAPTION_MODEL.name,
      },
      { status: statusCode },
    );
  }
}
