'use client';

/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import {
  Mic,
  UploadCloud,
  Disc,
  Loader2,
  X,
  Trash2,
  Music,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

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
  // Form State
  const [memoryName, setMemoryName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- File Handling Helper ---
  const processFiles = useCallback((newFiles: File[]) => {
    const validImages = newFiles.filter((file) => file.type.startsWith('image/'));

    setFiles((prev) => {
      if (prev.length + validImages.length > 10) {
        alert('Maximum 10 memories allowed per drop.');
        return prev;
      }
      return [...prev, ...validImages];
    });
  }, []);

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
  };

  // --- Audio Recorder Mock Logic ---

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setAudioBlob(new Blob(['mock-audio-data'], { type: 'audio/mp3' }));
    } else {
      setIsRecording(true);
      setAudioBlob(null);
      setRecordingTime(0);
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const deleteAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // --- Submission ---

  const handleSubmit = async () => {
    if (!memoryName) return alert('Please name your memory.');
    if (files.length === 0) return alert('Please add at least one photo.');

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('name', memoryName);
    files.forEach((file, i) => formData.append(`file_${i}`, file));
    if (audioBlob) formData.append('audio_context', audioBlob);

    await mockUploadService(formData);

    setIsSubmitting(false);
    alert('Memory Drop Successful! The AI is now curating your artifact.');
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
                    <p className="text-zinc-500 text-xs font-mono">Max 10 photos • JPG, PNG</p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full p-4 grid grid-cols-4 gap-3">
                  {files.map((file, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-lg overflow-hidden group/img bg-black/40 border border-white/10 shadow-sm"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="preview"
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
                  {files.length < 10 && (
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
                      isRecording ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'
                    }`}
                  />
                  Audio Context
                </span>
                {audioBlob && (
                  <button
                    onClick={deleteAudio}
                    className="text-zinc-500 hover:text-red-400 transition-colors text-xs flex items-center gap-1 group"
                  >
                    <Trash2 size={12} /> <span className="group-hover:underline">Clear</span>
                  </button>
                )}
              </div>

              <div className="bg-black/20 border border-white/5 rounded-xl p-1.5 overflow-hidden">
                {!audioBlob && !isRecording ? (
                  <button
                    onClick={toggleRecording}
                    className="w-full py-5 flex items-center justify-center gap-3 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/5"
                  >
                    <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                      <Mic size={16} />
                    </div>
                    <span className="text-sm font-medium">Record voice note</span>
                  </button>
                ) : isRecording ? (
                  <div className="w-full py-5 flex flex-col items-center justify-center gap-3 bg-black/40 rounded-lg relative overflow-hidden border border-white/10">
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
                    <button
                      onClick={toggleRecording}
                      className="z-10 px-6 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-full transition-colors backdrop-blur-md"
                    >
                      Stop Recording
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-4 flex items-center justify-between px-5 bg-black/20 rounded-lg border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-900/20 border border-green-900/30 flex items-center justify-center text-green-500">
                        <Music size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-200 font-medium">Audio Context Added</p>
                        <p className="text-xs text-zinc-500 font-mono mt-0.5">
                          {formatTime(recordingTime)} duration
                        </p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-white/10 mx-2" />
                    <button
                      onClick={() => setAudioBlob(null)}
                      className="p-2 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button className="flex-1 py-4 rounded-xl bg-transparent border border-white/10 text-zinc-400 text-sm font-medium hover:text-white hover:bg-white/5 hover:border-white/20 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-2 py-4 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} />
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
