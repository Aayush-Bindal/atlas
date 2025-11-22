/**
 * ATLAS Speech-to-Text Integration Example
 *
 * This file demonstrates how to integrate the speech-to-text helper
 * into your frontend components for audio context recording.
 *
 * Copy the relevant parts to your app/create/page.tsx or create a custom hook.
 */

import { useState, useEffect } from 'react';
import {
  speechToText,
  isWebSpeechSupported,
  checkMicrophoneAccess,
  getSupportedLanguages,
  SpeechToTextOptions,
  SpeechToTextResult
} from '@/lib/utils/speechToText';

/**
 * Custom hook for speech-to-text functionality
 * Handles recording state, errors, and transcription results
 */
export function useSpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [hasMicAccess, setHasMicAccess] = useState(false);

  // Check browser support on mount
  useEffect(() => {
    const checkSupport = async () => {
      setIsSupported(isWebSpeechSupported());
      setHasMicAccess(await checkMicrophoneAccess());
    };
    checkSupport();
  }, []);

  /**
   * Record speech and convert to text
   */
  const recordAudio = async (options?: Partial<SpeechToTextOptions>): Promise<SpeechToTextResult | null> => {
    if (isRecording) return null;

    setError(null);
    setTranscribedText('');

    try {
      const result = await speechToText({
        language: 'en-US',
        useOpenRouterFallback: true,
        maxRecordingTime: 15, // 15 seconds max

        // UI feedback callbacks
        onRecordingStart: () => setIsRecording(true),
        onRecordingEnd: () => setIsRecording(false),
        onInterimResult: setTranscribedText,

        ...options
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    recordAudio,
    isRecording,
    error,
    transcribedText,
    isSupported,
    hasMicAccess,
    clearError: () => setError(null),
    supportedLanguages: getSupportedLanguages()
  };
}

/**
 * Example component showing speech-to-text integration
 * This demonstrates how to use the helper in your create page
 */
export default function SpeechToTextExample() {
  const {
    recordAudio,
    isRecording,
    error,
    transcribedText,
    isSupported,
    hasMicAccess,
    clearError,
    supportedLanguages
  } = useSpeechToText();

  const [audioContexts, setAudioContexts] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');

  // Record audio context for a specific image
  const recordAudioForImage = async (imageIndex: number) => {
    try {
      const result = await recordAudio({
        language: selectedLanguage,
        onInterimResult: (text) => {
          // Show live transcription
          console.log('Live transcription:', text);
        }
      });

      if (result) {
        // Store the transcribed text for this image
        setAudioContexts(prev => {
          const newContexts = [...prev];
          newContexts[imageIndex] = result.text;
          return newContexts;
        });

        console.log(`Audio context recorded for image ${imageIndex}:`, result);
        alert(`Audio recorded! Method: ${result.method}, Duration: ${result.duration}ms`);
      }
    } catch (err) {
      console.error('Speech-to-text failed:', err);
      // Error is already handled by the hook
    }
  };

  // Browser support check
  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
        <h3 className="font-semibold">Speech Recognition Not Supported</h3>
        <p>Your browser doesn't support speech recognition. Using OpenRouter fallback for audio context.</p>
      </div>
    );
  }

  if (!hasMicAccess) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 rounded">
        <h3 className="font-semibold">Microphone Access Required</h3>
        <p>Please allow microphone access to record audio context for your images.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Speech-to-Text Integration</h2>

      {/* Language selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Language:</label>
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="border rounded p-2"
        >
          {supportedLanguages.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>

      {/* Recording buttons for each image */}
      <div className="space-y-2">
        <h3 className="font-semibold">Add Voice Context to Images:</h3>
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center space-x-2">
            <button
              onClick={() => recordAudioForImage(index)}
              disabled={isRecording}
              className={`px-4 py-2 rounded ${
                isRecording
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isRecording ? '🎤 Recording...' : `🎙️ Record Context for Image ${index + 1}`}
            </button>

            {audioContexts[index] && (
              <span className="text-green-600">✓ Context recorded</span>
            )}
          </div>
        ))}
      </div>

      {/* Live transcription display */}
      {isRecording && transcribedText && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Live Transcription:</strong> {transcribedText}
          </p>
        </div>
      )}

      {/* Recorded contexts display */}
      {audioContexts.some(context => context) && (
        <div className="space-y-2">
          <h3 className="font-semibold">Recorded Audio Contexts:</h3>
          {audioContexts.map((context, index) => (
            context && (
              <div key={index} className="p-2 bg-gray-50 rounded">
                <strong>Image {index + 1}:</strong> {context}
              </div>
            )
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </p>
          <button
            onClick={clearError}
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Usage instructions */}
      <div className="p-3 bg-gray-50 rounded text-sm">
        <h4 className="font-semibold mb-2">How to use:</h4>
        <ol className="list-decimal list-inside space-y-1">
          <li>Select your preferred language from the dropdown</li>
          <li>Click "Record Context" for each image you want to add voice context to</li>
          <li>Speak clearly about what you want the AI to know about that image</li>
          <li>The transcribed text will be sent to the captioning API for better results</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * Alternative: Simple function-based integration
 * If you prefer not to use the hook
 */
export async function simpleSpeechRecording(): Promise<string | null> {
  try {
    const result = await speechToText({
      language: 'en-US',
      useOpenRouterFallback: true,
      maxRecordingTime: 10
    });

    return result.text;
  } catch (error) {
    console.error('Speech recording failed:', error);
    return null;
  }
}

/**
 * Advanced: Batch recording for multiple images
 */
export async function recordMultipleContexts(imageCount: number): Promise<string[]> {
  const contexts: string[] = [];

  for (let i = 0; i < imageCount; i++) {
    console.log(`Recording context for image ${i + 1}...`);

    try {
      const result = await speechToText({
        language: 'en-US',
        useOpenRouterFallback: true,
        maxRecordingTime: 15
      });

      contexts.push(result.text);
      console.log(`✓ Context recorded for image ${i + 1}`);
    } catch (error) {
      console.warn(`✗ Failed to record context for image ${i + 1}:`, error);
      contexts.push(''); // Empty context for failed recordings
    }
  }

  return contexts;
}