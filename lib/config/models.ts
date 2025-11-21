// Environment-driven model configuration
export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const CAPTION_MODEL = {
  name: process.env.CAPTION_MODEL || "deepseek/deepseek-r1:free",
  maxTokens: 512,
  temperature: 0.3,
  timeout: 10000,
};

export const STORY_MODEL = {
  name: process.env.STORY_MODEL || "anthropic/claude-3.5-sonnet",
  maxTokens: 4096,
  temperature: 0.75,
  timeout: 45000,
};

export const HEADERS = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  "HTTP-Referer": process.env.VERCEL_URL || "http://localhost:3000",
  "X-Title": "ATLAS",
});
