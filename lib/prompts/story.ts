export const STORY_PROMPT = `Create a continuous past-tense story from these photos and verified captions. Use upbeat tone. Output JSON: {"pages":[{"orderIndex":1,"narrativeText":"..."}]}`;

export function buildStoryPrompt(
  images: { orderIndex: number; base64: string; metadata?: any }[],
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

      // Build metadata context string
      let metadataContext = "";
      if (img.metadata) {
        const parts = [];
        if (img.metadata.takenAt) {
          const date = new Date(img.metadata.takenAt);
          const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          parts.push(`taken on ${formattedDate}`);
        }
        if (img.metadata.latitude && img.metadata.longitude) {
          // Simple location approximation (could be enhanced with reverse geocoding)
          parts.push(`at location ${img.metadata.latitude.toFixed(2)}, ${img.metadata.longitude.toFixed(2)}`);
        }
        if (img.metadata.device) {
          parts.push(`with ${img.metadata.device}`);
        }
        if (parts.length > 0) {
          metadataContext = ` (${parts.join(', ')})`;
        }
      }

      return `orderIndex ${img.orderIndex}: <image>${img.base64}</image> | caption: ${caption}${metadataContext}`;
    })
    .join("\n");

  return `Global: ${global}\n${photoData}\n${STORY_PROMPT}`;
}
