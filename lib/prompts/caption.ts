export const CAPTION_PROMPT = `Describe this image in one factual sentence. Focus on visible subjects, actions, and setting.`;

export function buildCaptionPrompt(base64: string): string {
  return `<image>${base64}</image>\n${CAPTION_PROMPT}`;
}
