/**
 * Speech-to-Text utility for ATLAS frontend
 * Provides fast speech recognition with OpenRouter fallback
 *
 * @example
 * ```typescript
 * import { speechToText } from '@/lib/utils/speechToText';
 *
 * // Basic usage
 * const text = await speechToText();
 * console.log('Transcribed:', text);
 *
 * // With options
 * const text = await speechToText({
 *   language: 'en-US',
 *   useOpenRouterFallback: true
 * });
 * ```
 */

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

export interface SpeechToTextOptions {
  /** Language code (e.g., 'en-US', 'es-ES', 'fr-FR') */
  language?: string;
  /** Whether to use OpenRouter as fallback if Web Speech API fails */
  useOpenRouterFallback?: boolean;
  /** OpenRouter model to use for fallback */
  openRouterModel?: string;
  /** Maximum recording time in seconds */
  maxRecordingTime?: number;
  /** Callback for recording start */
  onRecordingStart?: () => void;
  /** Callback for recording end */
  onRecordingEnd?: () => void;
  /** Callback for interim results */
  onInterimResult?: (text: string) => void;
}

export interface SpeechToTextResult {
  text: string;
  method: 'web-speech-api' | 'openrouter';
  confidence?: number;
  duration: number;
}

/**
 * Main speech-to-text function with Web Speech API primary and OpenRouter fallback
 *
 * @param options - Configuration options
 * @returns Promise resolving to transcription result
 *
 * @throws {Error} When speech recognition is not supported or fails
 *
 * @example
 * ```typescript
 * // Simple usage
 * const result = await speechToText();
 * console.log(result.text);
 *
 * // With callbacks
 * const result = await speechToText({
 *   onRecordingStart: () => setRecordingState(true),
 *   onRecordingEnd: () => setRecordingState(false),
 *   onInterimResult: (text) => setInterimText(text)
 * });
 * ```
 */
export async function speechToText(options: SpeechToTextOptions = {}): Promise<SpeechToTextResult> {
  const startTime = Date.now();

  const {
    language = 'en-US',
    useOpenRouterFallback = true,
    openRouterModel = 'google/speech-to-text',
    maxRecordingTime = 30,
    onRecordingStart,
    onRecordingEnd,
    onInterimResult
  } = options;

  // Try Web Speech API first (fastest)
  try {
    const result = await webSpeechToText({
      language,
      maxRecordingTime,
      onRecordingStart,
      onRecordingEnd,
      onInterimResult
    });

    return {
      ...result,
      method: 'web-speech-api',
      duration: Date.now() - startTime
    };
  } catch (error) {
    console.warn('Web Speech API failed:', error);

    if (!useOpenRouterFallback) {
      throw error;
    }
  }

  // Fallback to OpenRouter
  try {
    const result = await openRouterSpeechToText({
      language,
      model: openRouterModel,
      maxRecordingTime,
      onRecordingStart,
      onRecordingEnd
    });

    return {
      ...result,
      method: 'openrouter',
      duration: Date.now() - startTime
    };
  } catch (error) {
    console.error('OpenRouter fallback also failed:', error);
    throw new Error('Speech-to-text conversion failed. Please try again or type your context manually.');
  }
}

/**
 * Web Speech API implementation (fastest, client-side)
 */
async function webSpeechToText(options: {
  language: string;
  maxRecordingTime: number;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
  onInterimResult?: (text: string) => void;
}): Promise<{ text: string; confidence?: number }> {
  return new Promise((resolve, reject) => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = options.language;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let interimTranscript = '';
    let timeoutId: NodeJS.Timeout;

    recognition.onstart = () => {
      options.onRecordingStart?.();
      // Set timeout for max recording time
      timeoutId = setTimeout(() => {
        recognition.stop();
      }, options.maxRecordingTime * 1000);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Call interim result callback
      if (interimTranscript && options.onInterimResult) {
        options.onInterimResult(finalTranscript + interimTranscript);
      }
    };

    recognition.onend = () => {
      clearTimeout(timeoutId);
      options.onRecordingEnd?.();

      if (finalTranscript.trim()) {
        resolve({
          text: finalTranscript.trim(),
          confidence: 0.8 // Web Speech API doesn't provide confidence
        });
      } else {
        reject(new Error('No speech detected. Please speak clearly and try again.'));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearTimeout(timeoutId);
      options.onRecordingEnd?.();

      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'Audio capture failed. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      reject(new Error(errorMessage));
    };

    // Request microphone permission and start
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => recognition.start())
      .catch(() => reject(new Error('Microphone access required for speech recognition')));
  });
}

/**
 * OpenRouter speech-to-text fallback (higher accuracy)
 */
async function openRouterSpeechToText(options: {
  language: string;
  model: string;
  maxRecordingTime: number;
  onRecordingStart?: () => void;
  onRecordingEnd?: () => void;
}): Promise<{ text: string; confidence?: number }> {
  // Record audio for the specified time
  const audioBlob = await recordAudioForOpenRouter(options.maxRecordingTime, options.onRecordingStart, options.onRecordingEnd);

  // Send to OpenRouter
  const formData = new FormData();
  formData.append('file', audioBlob);
  formData.append('model', options.model);
  formData.append('language', options.language);
  formData.append('response_format', 'json');

  const response = await fetch('/api/speech-to-text', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Speech-to-text API error: ${response.status}`);
  }

  const result = await response.json();
  return {
    text: result.text,
    confidence: result.confidence
  };
}

/**
 * Record audio for OpenRouter processing
 */
function recordAudioForOpenRouter(
  durationSeconds: number,
  onStart?: () => void,
  onEnd?: () => void
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        onEnd?.();
        resolve(audioBlob);
      };

      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('Audio recording failed'));
      };

      onStart?.();
      recorder.start();

      // Stop recording after specified duration
      setTimeout(() => {
        recorder.stop();
      }, durationSeconds * 1000);

    } catch (error) {
      reject(new Error('Audio recording not supported or permission denied'));
    }
  });
}

/**
 * Check if Web Speech API is supported
 */
export function isWebSpeechSupported(): boolean {
  return !!(typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition));
}

/**
 * Check if microphone access is available
 */
export async function checkMicrophoneAccess(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of supported languages for speech recognition
 */
export function getSupportedLanguages(): string[] {
  // Common language codes - can be expanded
  return [
    'en-US', 'en-GB', 'en-AU', 'en-CA',
    'es-ES', 'es-MX', 'es-AR',
    'fr-FR', 'fr-CA',
    'de-DE', 'de-AT',
    'it-IT',
    'pt-BR', 'pt-PT',
    'ja-JP',
    'ko-KR',
    'zh-CN', 'zh-TW',
    'ru-RU',
    'ar-SA',
    'hi-IN'
  ];
}