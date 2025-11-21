import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/openrouter";
import { HealthResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  console.log(`[${requestId}] HEALTH REQUEST:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  });

  let latency = 0;

  try {
    const client = createClient(5000);
    await client.post("/chat/completions", {
      model: "deepseek/deepseek-r1:free",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    latency = Date.now() - startTime;
  } catch (e) {
    latency = Date.now() - startTime;
  }

  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    openRouterLatencyMs: latency,
  };

  const duration = Date.now() - startTime;

  console.log(`[${requestId}] HEALTH RESPONSE:`, {
    status: response.status,
    latency: response.openRouterLatencyMs,
    duration,
    version: response.version,
  });

  return NextResponse.json(response);
}
