import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Log incoming request
    console.log(`[${requestId}] SPEECH-TO-TEXT REQUEST:`, {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
    });

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const model = formData.get('model') as string || 'google/speech-to-text';
    const language = formData.get('language') as string || 'en-US';

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log(`[${requestId}] SPEECH-TO-TEXT REQUEST BODY:`, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      model,
      language
    });

    // Create OpenRouter client
    const client = createClient(30000); // 30 second timeout for audio processing

    // Prepare form data for OpenRouter
    const openRouterFormData = new FormData();
    openRouterFormData.append('file', file);
    openRouterFormData.append('model', model);
    openRouterFormData.append('language', language);
    openRouterFormData.append('response_format', 'json');

    console.log(`[${requestId}] SPEECH-TO-TEXT API CALL:`, {
      model,
      language,
      fileSize: file.size
    });

    const response = await client.post('/audio/transcriptions', openRouterFormData, {
      headers: {
        // Let the client set Content-Type with boundary
      }
    });

    const result = response.data;

    const duration = Date.now() - startTime;

    console.log(`[${requestId}] SPEECH-TO-TEXT RESPONSE:`, {
      textLength: result.text?.length || 0,
      confidence: result.confidence,
      duration,
      model,
      status: 'success'
    });

    return NextResponse.json({
      text: result.text,
      confidence: result.confidence,
      language: result.language,
      duration
    });

  } catch (err: any) {
    const duration = Date.now() - startTime;

    console.error(`[${requestId}] SPEECH-TO-TEXT ERROR:`, {
      error: err.message,
      stack: err.stack,
      duration,
      status: 'error'
    });

    return NextResponse.json(
      { error: 'Speech-to-text processing failed', message: err.message },
      { status: 500 }
    );
  }
}