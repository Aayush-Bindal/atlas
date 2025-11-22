'use client';

import React, { useRef } from 'react';
import { ArrowLeft, Disc, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import HTMLFlipBook from 'react-pageflip';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// High Quality Portrait Images (Approx 2:3 Aspect Ratio)
const IMAGES: string[] = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800&auto=format&fit=crop', // Cover
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=800&auto=format&fit=crop', // Page 1
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=800&auto=format&fit=crop', // Page 2
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop', // Page 3
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=800&auto=format&fit=crop', // Page 4
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop', // Page 5
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop', // Page 6
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?q=80&w=800&auto=format&fit=crop', // Back cover
];

type PageFlipInstance = {
  pageFlip: () => {
    flipNext: () => void;
    flipPrev: () => void;
  };
};

type BookProps = {
  images: string[];
};

// --- BOOK COMPONENT (images only, cover + inner pages + back cover) ---
const Book = React.forwardRef<PageFlipInstance, BookProps>(({ images }, ref) => {
  if (!images || images.length < 2) return null;

  const coverImage = images[0];
  const backImage = images[images.length - 1];
  const innerImages = images.slice(1, images.length - 1);

  return (
    // react-pageflip's TS types are very strict / slightly off,
    // but these props are valid at runtime.
    // @ts-expect-error: react-pageflip typing mismatch
    <HTMLFlipBook
      width={370}
      height={500}
      maxShadowOpacity={0.5}
      drawShadow
      showCover
      size="fixed"
      usePortrait={false}
      className="demo-book"
      ref={ref}
    >
      {/* Cover */}
      <div className="page bg-transparent shadow-none">
        <div className="relative w-full h-full">
          <Image
            src={coverImage}
            alt="Cover"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 80vw, 370px"
            priority
          />
        </div>
      </div>

      {/* Inner pages */}
      {innerImages.map((src, idx) => (
        <div key={idx} className="page bg-transparent shadow-none">
          <div className="relative w-full h-full">
            <Image
              src={src}
              alt={`Page ${idx + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 80vw, 370px"
            />
          </div>
        </div>
      ))}

      {/* Back cover */}
      <div className="page bg-transparent shadow-none">
        <div className="relative w-full h-full">
          <Image
            src={backImage}
            alt="Back cover"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 80vw, 370px"
          />
        </div>
      </div>
    </HTMLFlipBook>
  );
});
Book.displayName = 'Book';

// --- BACKGROUND COMPONENT ---

const ImmersiveBackground = () => (
  <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050505]">
    <div className="absolute inset-0 z-0">
      <div className="relative w-full h-full">
        <Image
          src="/bg.png"
          alt="Background"
          fill
          className="object-cover opacity-20"
          priority
        />
      </div>
    </div>
    <div
      className="absolute inset-0 opacity-[0.05] z-10 mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
      }}
    />
    <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-black/80 z-20" />
  </div>
);

// --- MAIN VIEW ---

export default function App() {
  const router = useRouter();
  const bookRef = useRef<PageFlipInstance | null>(null);

  const nextFormat = () => {
    bookRef.current?.pageFlip().flipNext();
  };

  const prevFormat = () => {
    bookRef.current?.pageFlip().flipPrev();
  };

  return (
    <div className="bg-[#050505] min-h-screen w-full selection:bg-blue-500 selection:text-white font-sans relative text-white flex flex-col overflow-hidden">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
        .animate-pulse-slow { animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `,
        }}
      />

      <ImmersiveBackground />

      {/* --- NAVIGATION --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-24 flex items-center px-8 md:px-12 text-white pointer-events-none">
        <div className="flex-1 flex justify-start">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 pointer-events-auto cursor-pointer opacity-60 hover:opacity-100 transition-opacity group"
          >
            <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors border border-white/5 backdrop-blur-md">
              <ArrowLeft size={16} />
            </div>
            <span className="font-mono text-xs tracking-[0.2em] uppercase hidden md:block shadow-black drop-shadow-md font-bold">
              Exit View
            </span>
          </button>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="flex items-center gap-3">
            <Disc className="animate-spin-slow text-zinc-100 drop-shadow-lg" size={28} />
            <span className="font-bold text-2xl tracking-tighter text-white drop-shadow-lg">
              ATLAS
            </span>
          </div>
        </div>
        <div className="flex-1 flex justify-end gap-4 pointer-events-auto">
          <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md transition-colors border border-white/5 cursor-pointer">
            <Download size={18} />
          </button>
        </div>
      </nav>

      {/* --- MAIN CONTENT STAGE --- */}
      <main className="flex-1 flex items-center justify-center z-30 pt-12 overflow-hidden">
        <div className="relative flex items-center justify-center px-3">
          <Book images={IMAGES} ref={bookRef} />
        </div>
      </main>

      {/* --- CONTROLS --- */}
      <div className="fixed bottom-12 left-0 right-0 z-50 flex justify-center gap-8 pointer-events-none">
        <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-full pointer-events-auto shadow-2xl">
          <button
            onClick={prevFormat}
            className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-all text-white border border-white/5"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="px-6 text-center flex flex-col min-w-[120px]">
            <span className="text-sm font-bold text-white tracking-wide">
              FLIP
            </span>
            <span className="text-[10px] text-zinc-400 font-mono uppercase">
              Use Controls
            </span>
          </div>

          <button
            onClick={nextFormat}
            className="p-4 rounded-full bg-white/5 hover:bg-white/10 transition-all text-white border border-white/5"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
