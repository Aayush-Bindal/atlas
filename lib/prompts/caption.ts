import { ImageMetadata } from "../utils/validation";

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
