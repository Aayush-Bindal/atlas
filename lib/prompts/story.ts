import { ImageMetadata } from "../utils/validation";

export const STORY_SYSTEM = `You are a master storyteller creating vivid, engaging narratives from photo sequences.

STORYTELLING PRINCIPLES:
- Weave photos into a cohesive, chronological story
- Use rich, descriptive language that brings scenes to life
- Incorporate location and temporal context naturally
- Create emotional connections between moments
- Maintain consistent tone and pacing
- Reference specific details from captions and metadata

CRITICAL OUTPUT REQUIREMENT:
Return ONLY raw JSON - no markdown, no code fences, no explanations.
Do NOT wrap the JSON in \`\`\`json or \`\`\` markers.
Start your response with { and end with }

OUTPUT FORMAT:
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
