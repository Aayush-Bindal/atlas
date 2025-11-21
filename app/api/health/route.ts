import { NextResponse } from "next/server";
import { createClient } from "@/lib/openrouter";
import { HealthResponse } from "@/lib/types";

export async function GET() {
  const start = Date.now();
  let latency = 0;

  try {
    const client = createClient(5000);
    await client.post("/chat/completions", {
      model: "deepseek/deepseek-r1:free",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    latency = Date.now() - start;
  } catch (e) {
    latency = Date.now() - start;
  }

  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    openRouterLatencyMs: latency,
  };

  return NextResponse.json(response);
}
