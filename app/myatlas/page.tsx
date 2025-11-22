'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Disc,
  Plus,
  Loader2,
  Calendar,
  Image,
  FileText
} from 'lucide-react';

// Reused components from create page
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

// Mock data for the dashboard
const mockMemories = [
  {
    id: 'dharamshala-trip',
    title: 'Dharamshala Trip',
    createdAt: new Date().toISOString(),
    coverImage: '/bg.png',
    previewText: 'A serene journey through the mountains of Dharamshala. From ancient monasteries to misty trails, this trip captured the peaceful essence of the Himalayas...',
    imageCount: 12,
    wordCount: 847,
    status: 'completed'
  },
  {
    id: 'generating-atlas',
    title: 'Generating Atlas...',
    createdAt: null,
    coverImage: null,
    previewText: 'Processing your memories',
    imageCount: 0,
    wordCount: 0,
    status: 'generating',
    progress: 10
  }
];

const StatsCard = ({ icon: Icon, value, label }: { icon: any, value: string | number, label: string }) => (
  <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center">
    <div className="flex items-center justify-center mb-2">
      <Icon className="text-zinc-400" size={20} />
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-zinc-400 uppercase tracking-widest">{label}</div>
  </div>
);

const MemoryCard = ({ memory }: { memory: any }) => {
  const router = useRouter();

  if (memory.status === 'generating') {
    return (
      <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden opacity-60">
        <div className="p-6">
          <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-black/40 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-spin text-zinc-500" size={48} />
            </div>
          </div>
          <h3 className="font-serif italic text-xl text-zinc-400 mb-2">{memory.title}</h3>
          <div className="text-zinc-600 text-sm mb-4">{memory.previewText}</div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Generating Atlas...</span>
              <span>{memory.progress}%</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full"
                style={{ width: `${memory.progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-black/20 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors group cursor-pointer"
      onClick={() => {
        // Future: navigate to memory detail page
        console.log('Navigate to memory:', memory.id);
      }}
    >
      <div className="p-6">
        <div className="aspect-video rounded-lg overflow-hidden mb-4 bg-black/40">
          <img
            src={memory.coverImage}
            alt={memory.title}
            className="w-full h-full object-cover opacity-60"
          />
        </div>
        <h3 className="font-serif italic text-xl text-white mb-2">{memory.title}</h3>
        <div className="text-zinc-500 text-sm mb-4">
          {memory.createdAt ? 'Just now' : 'Processing...'}
        </div>
        <p className="text-zinc-400 text-sm line-clamp-3 mb-4">{memory.previewText}</p>
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{memory.imageCount} photos</span>
          <span>{memory.wordCount} words</span>
        </div>
      </div>
    </div>
  );
};

const CreateNewCard = () => {
  const router = useRouter();

  return (
    <div
      className="bg-black/10 border border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-black/20 hover:border-white/20 transition-all cursor-pointer group"
      onClick={() => router.push('/create')}
    >
      <Plus className="text-zinc-500 group-hover:text-white mb-4" size={48} />
      <div className="text-center">
        <div className="text-white font-medium mb-1">Create New Memory</div>
        <div className="text-zinc-500 text-sm">Start a new story</div>
      </div>
    </div>
  );
};

export default function MyAtlasPage() {
  const completedMemories = mockMemories.filter(m => m.status === 'completed');
  const totalImages = completedMemories.reduce((sum, m) => sum + m.imageCount, 0);
  const totalWords = completedMemories.reduce((sum, m) => sum + m.wordCount, 0);

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
          .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        `
        }}
      />

      <ImmersiveBackground />
      <Navigation />

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 z-30 relative pt-24">
        {/* Glassmorphism Card Container */}
        <div className="w-full max-w-6xl glass-panel rounded-4xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-700">
          {/* Subtle top shine */}
          <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

          <div className="p-8 md:p-14 relative flex flex-col gap-10">
            {/* Header Section */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-mono text-zinc-300 uppercase tracking-widest mb-2 backdrop-blur-md">
                Your Atlas
              </div>
              <h1 className="font-serif italic text-4xl md:text-5xl text-white tracking-tight drop-shadow-md">
                Memory Vault
              </h1>
              <p className="text-zinc-400 text-sm font-medium">Your AI-crafted stories, preserved forever.</p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-4">
              <StatsCard icon={FileText} value={completedMemories.length} label="Memories" />
              <StatsCard icon={Image} value={totalImages} label="Photos" />
              <StatsCard icon={Calendar} value={totalWords} label="Words" />
            </div>

            {/* Memories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
              <CreateNewCard />
            </div>
          </div>

          {/* Bottom Card Decoration */}
          <div className="h-px w-full bg-linear-to-r from-transparent via-white/10 to-transparent absolute bottom-0" />
        </div>
      </main>
    </div>
  );
}