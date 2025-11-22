'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import {
  Mic,
  UploadCloud,
  Disc,
  Loader2,
  X,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

// ATLAS Integration
import { AtlasWorkflow } from '@/lib/utils/workflow';
import { speechToText, isWebSpeechSupported } from '@/lib/utils/speechToText';
import { WorkflowState } from '@/lib/utils/workflow';

// --- Types & Constants ---

type UploadPayload = FormData;

// Precomputed waveform bar heights so we don't call Math.random() during render
const WAVEFORM_BARS = Array.from({ length: 24 }, () => 20 + Math.random() * 60);

// --- Mock API Service ---
const mockUploadService = async (data: UploadPayload) => {
  return new Promise<{ success: boolean; id: string }>((resolve) => {
    setTimeout(() => {
      console.log('Payload sent to API:', data);
      resolve({ success: true, id: 'mem_' + Date.now() });
    }, 2000);
  });
};

// --- Reused Aesthetic Components ---

const ImmersiveBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050505]">
      {/* 1. Static Image Background Layer */}
      <div className="absolute inset-0 z-0">
        <img
          src="/bg.png"
          alt="Background"
          className="w-full h-full object-cover opacity-30"
        />
      </div>

      {/* 2. Noise Overlay - adds texture */}
      <div
        className="absolute inset-0 opacity-[0.05] z-10 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* 3. Gradient Vignette - focuses attention on the center card */}
      <div className="absolute inset-0 bg-linear-to-b from-black/60 via-black/10 to-black/80 z-20" />
    </div>
  );
};

const Navigation = () => {
  const router = useRouter();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-24 flex items-center px-8 md:px-12 text-white pointer-events-none backdrop-blur-sm bg-linear-to-b from-black/60 to-transparent">
      {/* Left: Back Action */}
      <div className="flex-1 flex justify-start">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-3 pointer-events-auto cursor-pointer opacity-60 hover:opacity-100 transition-opacity group"
        >
          <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors border border-white/5 backdrop-blur-md">
            <ArrowLeft size={16} />
          </div>
          <span className="font-mono text-xs tracking-[0.2em] uppercase hidden md:block shadow-black drop-shadow-md">
            Back to Orbit
          </span>
        </button>
      </div>

      {/* Center: Logo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
        <div className="flex items-center gap-3">
          <Disc
            className="animate-spin-slow text-zinc-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]"
            size={28}
          />
          <span className="font-bold text-2xl tracking-tighter text-white drop-shadow-lg">
            ATLAS
          </span>
        </div>
      </div>

      {/* Right: Spacer */}
      <div className="flex-1 flex justify-end" />
    </nav>
  );
};

// --- Main Create Page Component ---

export default function CreatePage() {
  const router = useRouter();

  // Form State (UI)
  const [memoryName, setMemoryName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // ATLAS Workflow Integration
  const workflow = useRef(new AtlasWorkflow()).current;
  const [audioContext, setAudioContext] = useState<string>('');
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{
    type: 'processing' | 'transcription' | 'api' | 'general';
    message: string;
  } | null>(null);
  const [success, setSuccess] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionControllerRef = useRef<{ stop: () => void } | null>(null);

  // Setup workflow subscription
  useEffect(() => {
    const unsubscribe = workflow.subscribe((state) => {
      setWorkflowState(state);
    });
    return unsubscribe;
  }, [workflow]);

  // --- File Handling Helper ---
  const processFiles = useCallback(async (newFiles: File[]) => {
    try {
      setError(null);

      // Validate file count
      const currentCount = workflowState?.images.length || 0;
      if (currentCount + newFiles.length > 15) {
        setError({ type: 'processing', message: 'Maximum 15 images allowed.' });
        return;
      }

      // Filter valid images
      const validImages = newFiles.filter((file) => file.type.startsWith('image/'));
      if (validImages.length === 0) {
        setError({ type: 'processing', message: 'No valid image files found.' });
        return;
      }

      // Use workflow's processFiles method to handle everything
      await workflow.processFiles(validImages);
      setFiles(prev => [...prev, ...validImages]); // Keep for UI display

    } catch (error) {
      console.error('Image processing failed:', error);
      setError({
        type: 'processing',
        message: error instanceof Error ? error.message : 'Failed to process images'
      });
    }
  }, [workflow, workflowState?.images.length]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFiles = Array.from(e.dataTransfer.files);
      processFiles(droppedFiles);
    },
    [processFiles]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    // Note: Workflow doesn't have a remove method, so we need to reset and re-process
    // For now, we'll just remove from UI but keep workflow state as-is
    // TODO: Add removeImage method to AtlasWorkflow
  };

  // --- Audio Recording with Real Speech-to-Text ---

  const startRecording = async () => {
    try {
      setError(null);
      setAudioContext(''); // Clear previous transcription
      
      // Check if Web Speech API is supported
      if (!isWebSpeechSupported()) {
        setError({
          type: 'transcription',
          message: 'Speech recognition not supported in this browser. Please type your context manually below.'
        });
        return;
      }
      
      // Start speech recognition with all callbacks
      const result = await speechToText({
        language: 'en-US',
        maxRecordingTime: 30,

        onRecordingStart: () => {
          setIsRecording(true);
          setRecordingTime(0);
          intervalRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
        },

        onRecordingEnd: () => {
          setIsRecording(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        },

        onInterimResult: (text) => {
          // Optional: show interim results in real-time
          console.log('Interim transcript:', text);
        }
      });

      setAudioContext(result.text);
      console.log('Audio transcribed successfully:', result);

    } catch (error) {
      console.error('Speech-to-text failed:', error);
      setError({
        type: 'transcription',
        message: error instanceof Error ? error.message : 'Failed to transcribe audio. Please type your context manually below.'
      });
      
      // Clean up on error
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const deleteAudio = () => {
    setAudioContext('');
    setRecordingTime(0);
    setIsRecording(false);
    setIsTranscribing(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- Submission with Real API Integration ---

  const handleSubmit = async () => {
    if (!memoryName.trim()) {
      setError({ type: 'general', message: 'Please name your memory.' });
      return;
    }

    if ((workflowState?.images.length || 0) === 0) {
      setError({ type: 'general', message: 'Please add at least one photo.' });
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Set global context from form
      workflow.setGlobalAnswers({
        purpose: memoryName.trim(),
        mood: 'memorable' // Could be made configurable in future
      });

      // Execute the workflow
      await workflow.generateCaptions();
      await workflow.generateStory();

      const finalState = workflow.getState();
      if (finalState.story) {
        setSuccess(true);
        console.log('Memory created successfully:', finalState.story);
        // Navigate to dashboard
        router.push('/myatlas');
      } else {
        throw new Error('Story generation failed');
      }

    } catch (error) {
      console.error('Memory creation failed:', error);
      setError({
        type: 'api',
        message: error instanceof Error ? error.message : 'Failed to create memory'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get current processing step for UI feedback
  const getProcessingStep = () => {
    if (!workflowState) return '';
    if (workflowState.isProcessing) return 'Processing images...';
    if (workflowState.isGeneratingCaptions) return 'Generating captions...';
    if (workflowState.isGeneratingStory) return 'Creating your story...';
    return '';
  };

  return (
    <div className="bg-[#050505] min-h-screen w-full selection:bg-zinc-700 selection:text-white font-sans relative text-white flex flex-col overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
        .glass-panel {
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
      `
        }}
      />

      <ImmersiveBackground />
      <Navigation />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 z-30 relative pt-24">
        {/* Glassmorphism Card Container */}
        <div className="w-full max-w-xl glass-panel rounded-4xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-700">
          {/* Subtle top shine */}
          <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

          <div className="p-8 md:p-14 relative flex flex-col gap-10">
            {/* Header Section */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-mono text-zinc-300 uppercase tracking-widest mb-2 backdrop-blur-md">
                New Artifact
              </div>
              <h1 className="font-serif italic text-4xl md:text-5xl text-white tracking-tight drop-shadow-md">
                The Drop
              </h1>
              <p className="text-zinc-400 text-sm font-medium">Drag, drop, and describe your moment.</p>
            </div>

            {/* 1. Name Input */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name this memory..."
                className="w-full bg-transparent border-b border-white/10 py-4 text-center text-2xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-all font-serif italic"
                value={memoryName}
                onChange={(e) => setMemoryName(e.target.value)}
              />
            </div>

            {/* 2. Drag & Drop Zone */}
            <div
              className={`
                group relative border border-dashed rounded-2xl min-h-[200px] flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer overflow-hidden
                ${
                  files.length > 0
                    ? 'border-white/20 bg-black/20'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5 bg-black/10'
                }
              `}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />

              {files.length === 0 ? (
                <div className="flex flex-col items-center gap-5 py-8 px-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform shadow-lg backdrop-blur-sm">
                    <UploadCloud className="text-zinc-400" size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-300 font-medium text-sm">Drag files here or click to upload</p>
                    <p className="text-zinc-500 text-xs font-mono">Max 15 photos • Auto-compressed • JPG, PNG</p>
                  </div>
                </div>
              ) : (
                 <div className="w-full h-full p-4 grid grid-cols-4 gap-3">
                   {(workflowState?.images || []).map((processedImg, i) => (
                     <div
                       key={i}
                       className="relative aspect-square rounded-lg overflow-hidden group/img bg-black/40 border border-white/10 shadow-sm"
                     >
                       <img
                         src={processedImg.base64}
                         alt="processed preview"
                         className="w-full h-full object-cover opacity-90 group-hover/img:opacity-100 transition-opacity"
                       />
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           removeFile(i);
                         }}
                         className="absolute top-1 right-1 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-all hover:bg-red-500"
                       >
                         <X size={10} />
                       </button>
                     </div>
                   ))}
                   {(workflowState?.images.length || 0) < 15 && (
                    <div className="aspect-square rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 hover:text-zinc-300 hover:border-white/20 hover:bg-white/5 transition-all gap-1">
                      <span className="text-xl font-light">+</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Audio Context */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isRecording ? 'bg-red-500 animate-pulse' :
                        isTranscribing ? 'bg-blue-500 animate-pulse' :
                        audioContext ? 'bg-green-500' : 'bg-zinc-500'
                      }`}
                    />
                    Story Context
                  </span>
                  {(audioContext || isTranscribing) && (
                    <button
                      onClick={deleteAudio}
                      className="text-zinc-500 hover:text-red-400 transition-colors text-xs flex items-center gap-1 group"
                    >
                      <Trash2 size={12} /> <span className="group-hover:underline">Clear</span>
                    </button>
                  )}
                </div>

                <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
                  {/* Primary: Text Input (always available) */}
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 font-mono uppercase tracking-widest">
                      Describe your story context
                    </label>
                    <textarea
                      placeholder="Type or record context about your photos... (e.g., 'Birthday party at Tokyo Disneyland with family')"
                      value={audioContext}
                      onChange={(e) => setAudioContext(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 rounded-lg px-3 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-all resize-none"
                      rows={3}
                      disabled={isRecording || isTranscribing}
                    />
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{audioContext.length} characters</span>
                      <span className="text-zinc-600">Optional • Helps AI understand your story</span>
                    </div>
                  </div>

                  {/* Secondary: Voice Recording */}
                  <div className="border-t border-white/5 pt-3">
                    {!isRecording && !isTranscribing ? (
                      <button
                        onClick={startRecording}
                        className="w-full py-3 flex items-center justify-center gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/5 group"
                        disabled={!audioContext.trim() && !isWebSpeechSupported()}
                      >
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                          <Mic size={14} />
                        </div>
                        <span className="text-sm font-medium">
                          {audioContext.trim() ? 'Add voice context' : 'Record voice context'}
                        </span>
                      </button>
                    ) : isRecording ? (
                      <div className="w-full py-4 flex flex-col items-center justify-center gap-3 bg-black/40 rounded-lg border border-white/10 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-30">
                          {WAVEFORM_BARS.map((height, i) => (
                            <div
                              key={i}
                              className="w-0.5 bg-red-500 rounded-full animate-pulse"
                              style={{
                                height: `${height}%`,
                                animationDelay: `${i * 0.05}s`,
                                animationDuration: '0.4s'
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-xl font-mono font-bold text-white z-10 tracking-widest">
                          {formatTime(recordingTime)}
                        </span>
                        <p className="text-xs text-zinc-400 z-10">Speak now... (auto-stops after 30s or when you finish)</p>
                      </div>
                    ) : (
                      <div className="w-full py-4 flex flex-col items-center justify-center gap-3 bg-black/40 rounded-lg border border-blue-500/20">
                        <Loader2 className="animate-spin text-blue-400" size={24} />
                        <span className="text-sm text-blue-400 font-medium">Transcribing audio...</span>
                        <span className="text-xs text-zinc-500">This may take a few seconds</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <X size={14} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {error.type.toUpperCase()} ERROR
                  </span>
                </div>
                <p className="text-sm text-red-300">{error.message}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Success Display */}
            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <CheckCircle size={14} />
                  <span className="text-xs font-bold uppercase tracking-widest">
                    MEMORY CREATED
                  </span>
                </div>
                <p className="text-sm text-green-300">
                  Your AI-generated story is ready! Check the console for details.
                </p>
              </div>
            )}

            {/* Processing Progress */}
            {workflowState?.progress && workflowState.progress.totalImages > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Processing Images</span>
                  <span>{workflowState.progress.imagesProcessed}/{workflowState.progress.totalImages}</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{
                      width: `${(workflowState.progress.imagesProcessed / workflowState.progress.totalImages) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* 4. Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button className="flex-1 py-4 rounded-xl bg-transparent border border-white/10 text-zinc-400 text-sm font-medium hover:text-white hover:bg-white/5 hover:border-white/20 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isTranscribing || (workflowState?.images.length || 0) === 0}
                className="flex-2 py-4 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    {getProcessingStep() || 'Creating Memory...'}
                  </div>
                ) : isTranscribing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} />
                    Transcribing Audio...
                  </div>
                ) : (
                  <>
                    Start Dropping{' '}
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Card Decoration */}
          <div className="h-px w-full bg-linear-to-r from-transparent via-white/10 to-transparent absolute bottom-0" />
        </div>
      </main>
    </div>
  );
}
