export const STORY_PROMPT = `Create a continuous past-tense story from these photos and verified captions. Use upbeat tone. Output JSON: {"pages":[{"orderIndex":1,"narrativeText":"..."}]}`;

export function buildStoryPrompt(
  images: { orderIndex: number; base64: string }[],
  contexts: { orderIndex: number; text: string }[],
  globalAnswers: Record<string, string>,
): string {
  const global = Object.entries(globalAnswers)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
  const photoData = images
    .map((img) => {
      const caption =
        contexts.find((c) => c.orderIndex === img.orderIndex)?.text || "";
      return `orderIndex ${img.orderIndex}: <image>${img.base64}</image> | caption: ${caption}`;
    })
    .join("\n");

  return `Global: ${global}\n${photoData}\n${STORY_PROMPT}`;
}
