import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/openrouter";
import { CAPTION_MODEL } from "@/lib/config/models";
import { buildCaptionPrompt } from "@/lib/prompts/caption";
import { logger } from "@/lib/utils/logger";
import { CaptionRequest, CaptionResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: CaptionRequest = await req.json();
    const { image } = body;

    const prompt = buildCaptionPrompt(image.base64);
    logger.info(
      { route: "caption", orderIndex: image.orderIndex },
      "Generating caption",
    );

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

    logger.info(
      {
        route: "caption",
        orderIndex: image.orderIndex,
        captionLength: caption.length,
      },
      "Caption generated",
    );
    return NextResponse.json(response);
  } catch (err: any) {
    logger.error(
      { route: "caption", error: err.message },
      "Caption generation failed",
    );
    return NextResponse.json(
      { error: "OPENROUTER_ERROR", message: err.message },
      { status: 502 },
    );
  }
}
