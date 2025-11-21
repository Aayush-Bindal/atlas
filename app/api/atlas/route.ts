import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/openrouter";
import { STORY_MODEL } from "@/lib/config/models";
import { buildStoryPrompt } from "@/lib/prompts/story";
import { logger } from "@/lib/utils/logger";
import { StoryRequest, StoryResponse } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: StoryRequest = await req.json();
    const { images, contexts, globalAnswers } = body;

    const prompt = buildStoryPrompt(images, contexts, globalAnswers);
    logger.info({ route: "story", images: images.length }, "Generating story");

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

    logger.info(
      { route: "story", pages: json.pages?.length },
      "Story generated",
    );
    return NextResponse.json(response);
  } catch (err: any) {
    logger.error(
      { route: "story", error: err.message },
      "Story generation failed",
    );
    return NextResponse.json(
      { error: "OPENROUTER_ERROR", message: err.message },
      { status: 502 },
    );
  }
}
