"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ArrowRight,
  Mic,
  Disc,
  Scan,
  Sparkles,
  Layers,
  MapPin,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// --- Helpers (no Math.random in render) ---

function pseudoRandom(seed: number): number {
  // deterministic pseudo-random in [0,1)
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// --- Types & Interfaces ---

interface FloatingImage {
  id: number;
  src: string;
  alt: string;
  x: number;
  y: number;
  z: number;
  rotate: number;
  scale: number;
}

interface Step {
  id: string;
  title: string;
  desc: string;
  image: string;
}

interface Particle {
  id: number;
  top: string; // already formatted without %
  left: string; // already formatted without %
  size: string; // px value as string
  opacity: string; // 0.xxxxxx as string
  boxShadow: string;
}

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

// --- Mock Data ---

const FLOATING_IMAGES: FloatingImage[] = [
  {
    id: 1,
    src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=500&q=80",
    alt: "Wedding",
    x: 15,
    y: 15,
    z: 1,
    rotate: -6,
    scale: 0.8,
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&q=80",
    alt: "Friends",
    x: 75,
    y: 20,
    z: 0,
    rotate: 8,
    scale: 0.9,
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=500&q=80",
    alt: "Concert",
    x: 25,
    y: 65,
    z: 2,
    rotate: -12,
    scale: 1.1,
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80",
    alt: "Party",
    x: 65,
    y: 75,
    z: 1,
    rotate: 4,
    scale: 0.85,
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=80",
    alt: "Event",
    x: 48,
    y: 35,
    z: 0,
    rotate: 6,
    scale: 0.75,
  },
  {
    id: 6,
    src: "https://images.unsplash.com/photo-1530103862676-de3c9a59af38?w=500&q=80",
    alt: "Trip",
    x: 8,
    y: 85,
    z: 3,
    rotate: -10,
    scale: 0.95,
  },
  {
    id: 7,
    src: "https://images.unsplash.com/photo-1516450360452-631d408d526b?w=500&q=80",
    alt: "Beach",
    x: 88,
    y: 45,
    z: 2,
    rotate: 15,
    scale: 1.0,
  },
  {
    id: 8,
    src: "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=500&q=80",
    alt: "Friends 2",
    x: 35,
    y: 10,
    z: 0,
    rotate: -3,
    scale: 0.6,
  },
  {
    id: 9,
    src: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=500&q=80",
    alt: "Party 2",
    x: 82,
    y: 85,
    z: 1,
    rotate: 9,
    scale: 0.7,
  },
];

// --- Hooks ---

const useOnScreen = (options: IntersectionObserverInit) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, isVisible] as const;
};

const useSmoothParallax = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        container.style.setProperty("--mouse-x", x.toString());
        container.style.setProperty("--mouse-y", y.toString());
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return containerRef;
};

const useScrollY = () => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return scrollY;
};

// --- Components ---

const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const [ref, isVisible] = useOnScreen({ threshold: 0.1 });

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 transform ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * Immersive background with deterministic, formatted particles
 * -> no Math.random, no float precision mismatch.
 */
const ImmersiveBackground: React.FC = () => {
  const scrollY = useScrollY();

  const particles = useMemo<Particle[]>(
    () =>
      [...Array(50)].map((_, i) => {
        const r1 = pseudoRandom(i * 5 + 1);
        const r2 = pseudoRandom(i * 5 + 2);
        const r3 = pseudoRandom(i * 5 + 3);
        const r5 = pseudoRandom(i * 5 + 5);

        const top = (r1 * 100).toFixed(4);
        const left = (r2 * 100).toFixed(4);
        const size = (r3 * 2 + 1).toFixed(3); // px
        const opacity = (r5 * 0.6 + 0.2).toFixed(6);
        const blur = (parseFloat(size) * 2).toFixed(3);
        const boxShadow = `0 0 ${blur}px rgba(255,255,255,${(
          parseFloat(opacity) * 0.5
        ).toFixed(6)})`;

        return {
          id: i,
          top,
          left,
          size,
          opacity,
          boxShadow,
        };
      }),
    [],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#050505]">
      {/* Base Noise Texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Layer 1: Stars/Dust */}
      <div
        className="absolute inset-0"
        style={{ transform: `translateY(-${scrollY * 0.1}px)` }}
      >
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: Number(p.opacity),
              boxShadow: p.boxShadow,
            }}
          />
        ))}
      </div>

      {/* Layer 2: Larger Floating Debris (Closer) */}
      <div
        className="absolute inset-0"
        style={{ transform: `translateY(-${scrollY * 0.3}px)` }}
      >
        <div className="absolute top-[20%] left-[10%] w-1 h-24 bg-linear-to-b from-transparent via-zinc-700 to-transparent opacity-20 rotate-12 blur-[1px]" />
        <div className="absolute top-[60%] right-[15%] w-32 h-1 bg-linear-to-r from-transparent via-zinc-700 to-transparent opacity-20 -rotate-45 blur-[1px]" />
        <div className="absolute top-[40%] left-[50%] w-1.5 h-1.5 bg-white rounded-full opacity-20 blur-[2px]" />
      </div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-[#050505] to-transparent pointer-events-none" />
    </div>
  );
};

const Navigation: React.FC = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 mix-blend-difference text-white pointer-events-none">
    <div className="flex items-center gap-2 pointer-events-auto">
      <Disc className="animate-spin-slow" size={24} />
      <span className="font-bold text-xl tracking-tighter">ATLAS</span>
    </div>
    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400 pointer-events-auto">
      <a href="/dashboard" className="hover:text-white transition-colors">
        Dashboard
      </a>
      <a href="explore" className="hover:text-white transition-colors">
        Explore
      </a>
      <a href="pricing" className="hover:text-white transition-colors">
        Pricing
      </a>
    </div>
    <div className="flex items-center gap-4 pointer-events-auto">
      <button className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-zinc-200 transition-colors">
        Start Atlas
      </button>
    </div>
  </nav>
);

const Hero: React.FC = () => {
  const containerRef = useSmoothParallax();
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const words = ['The Wedding', 'The Road Trip', 'The Reunion', 'That Night'];
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [words.length]);

  return (
    <section
      ref={containerRef}
      className="section-snap relative h-screen w-full overflow-hidden flex flex-col items-center justify-center bg-transparent perspective-1000 z-10"
    >
      {/* Hero-specific background */}
      <div className="absolute inset-0 z-0 transform-style-3d">
        {FLOATING_IMAGES.map((img) => (
          <div
            key={img.id}
            className="absolute transition-transform duration-800 ease-out will-change-transform"
            style={{
              left: `${img.x}%`,
              top: `${img.y}%`,
              zIndex: img.z,
              transform: `
                translate(
                  calc(var(--mouse-x, 0) * ${20 * (img.z + 0.5)}px), 
                  calc(var(--mouse-y, 0) * ${20 * (img.z + 0.5)}px)
                ) 
                rotate(${img.rotate}deg) 
                scale(${img.scale})
              `,
            }}
          >
            <div className="group relative w-32 h-40 md:w-48 md:h-64 bg-zinc-900 p-1.5 pb-6 shadow-2xl hover:z-50 hover:scale-110 transition-all duration-500 ease-out cursor-pointer">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-4 bg-white/20 backdrop-blur-sm rotate-1" />
              <div className="w-full h-full overflow-hidden bg-black relative">
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500 grayscale group-hover:grayscale-0"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                  <span className="text-white text-xs font-mono">
                    {img.alt}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_90%)] pointer-events-none" />
      </div>

      <div className="relative z-10 text-center max-w-5xl px-4">
        <AnimatedSection>
          <h1 className="text-8xl md:text-[11rem] leading-[0.8] font-bold text-transparent bg-clip-text bg-linear-to-b from-white to-zinc-700 tracking-tighter mb-8 mix-blend-overlay">
            ATLAS
          </h1>
        </AnimatedSection>

        <AnimatedSection delay={200}>
          <div className="text-xl md:text-3xl text-zinc-400 font-light mb-12 h-16 flex items-center justify-center gap-3">
            <span className="font-serif italic text-zinc-500">Revisit</span>
            <span className="text-white font-medium relative h-[1.2em] w-auto min-w-[200px] overflow-hidden inline-flex justify-center items-center">
              {words.map((word, i) => (
                <span
                  key={word}
                  className={`absolute transition-all duration-700 transform ${
                    i === activeWordIndex
                      ? "translate-y-0 opacity-100 blur-0"
                      : "translate-y-full opacity-0 blur-sm"
                  }`}
                >
                  {word}
                </span>
              ))}
            </span>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={400}>
              <button className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-zinc-200 transition-all hover:scale-105 flex items-center gap-2 mx-auto" onClick={() => router.push('/create')}>
                Create a Room <ArrowRight size={18} />
              </button>
        </AnimatedSection>
      </div>
    </section>
  );
};

/**
 * AlchemySection with deterministic, formatted bar heights
 */
const AlchemySection: React.FC = () => {
  const barHeights = useMemo<string[]>(
    () =>
      [...Array(12)].map((_, i) => {
        const r = pseudoRandom(1000 + i);
        return (r * 100).toFixed(2); // string %, stable
      }),
    [],
  );

  return (
    <section className="section-snap relative bg-transparent py-40 overflow-hidden z-10">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 border border-zinc-800 rounded-full px-4 py-1 text-xs text-zinc-500 uppercase tracking-widest mb-8 bg-[#050505]/50 backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Context Engine v1.0
              </div>
              <h2 className="text-5xl md:text-7xl font-bold text-white leading-none tracking-tighter mb-8">
                The{" "}
                <span className="font-serif italic text-zinc-500">Alchemy</span>{" "}
                of Memory.
              </h2>
              <p className="text-xl text-zinc-400 leading-relaxed max-w-md">
                Raw photos are static. Voice notes are messy. Atlas fuses them.
                We listen to the chaos of the party and distill it into a
                coherent, captioned narrative.
              </p>
            </div>

            <div className="relative h-[500px] w-full flex items-center justify-center">
              <div className="absolute w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
              <div className="relative w-72 h-96">
                <div className="absolute inset-0 bg-zinc-900 border border-zinc-800 rounded-xl transform rotate-6 scale-90 opacity-40" />
                <div className="absolute inset-0 bg-zinc-900 border border-zinc-800 rounded-xl transform -rotate-3 scale-95 opacity-70" />
                {/* Main Card */}
                <div className="absolute inset-0 bg-[#0A0A0A] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                  <div className="h-1/2 bg-zinc-900 relative overflow-hidden group">
                    <img
                      src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=500&q=80"
                      className="w-full h-full object-cover opacity-50 group-hover:opacity-80 transition-opacity duration-700 grayscale"
                      alt="Party"
                    />
                    <div className="absolute inset-0 bg-linear-to-b from-transparent to-[#0A0A0A]" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-1 h-6">
                      {barHeights.map((height, i) => (
                        <div
                          key={i}
                          className="w-1 bg-white/50 rounded-full animate-pulse"
                          style={{
                            height: `${height}%`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="h-1/2 p-6 relative">
                    <div className="absolute top-0 left-6 -translate-y-1/2 w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-black shadow-lg shadow-white/10">
                      <Mic size={18} />
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="h-2 w-24 bg-zinc-800 rounded animate-pulse" />
                      <p className="text-zinc-300 font-serif italic text-lg leading-snug">
                        &ldquo;The exact moment the music stopped and everyone
                        held their breath...&rdquo;
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest mt-4">
                        <span className="w-2 h-2 bg-zinc-500 rounded-full" />
                        Generated by Atlas
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

/**
 * Scrapbook / "We connect the dots" section
 */
const ScrapbookSection: React.FC = () => {
  return (
    <section className="section-snap bg-transparent py-40 relative overflow-hidden border-t border-zinc-900/50 z-10">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-32">
          <AnimatedSection>
            <div className="inline-flex items-center gap-2 text-zinc-400 mb-4 border border-zinc-800 px-3 py-1 rounded-full bg-[#050505]/50 backdrop-blur-sm">
              <Layers size={14} />
              <span className="text-xs font-mono uppercase tracking-widest">
                Narrative Construction
              </span>
            </div>
            <h2 className="text-4xl md:text-7xl font-bold text-white tracking-tighter mb-6 leading-none">
              We connect the <br />
              <span className="font-serif italic font-normal text-zinc-500">
                dots.
              </span>
            </h2>
          </AnimatedSection>
        </div>

        <div className="relative h-[800px] w-full max-w-6xl mx-auto">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
            <path
              d="M450,350 C550,350 550,250 650,250"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="5,5"
            />
            <path
              d="M400,450 C300,550 200,500 180,600"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M750,280 C800,350 850,400 850,500"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="5,5"
            />
            <path
              d="M450,350 C350,250 250,200 200,150"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M850,500 C950,550 1000,600 1050,650"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              fill="none"
              strokeDasharray="3,3"
            />
            <path
              d="M650,250 C750,150 800,100 850,100"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              fill="none"
            />
          </svg>

          {/* Center polaroid */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 animate-float"
            style={{ animationDelay: "0s" }}
          >
            <div className="group relative transform -rotate-3 hover:rotate-0 transition-transform duration-500 cursor-pointer hover:z-50">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-6 bg-white/10 backdrop-blur rotate-1 z-10" />
              <div className="bg-zinc-100 p-3 pb-12 shadow-2xl max-w-[280px] md:max-w-[320px] relative">
                <img
                  src="https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600&q=80"
                  className="w-full h-auto grayscale contrast-125 group-hover:grayscale-0 transition-all duration-700"
                  alt="Chaotic Party"
                />
                <div className="absolute bottom-3 left-4 font-serif text-black text-sm italic">
                  &quot;Exhibit A: The Toast&quot;
                </div>
              </div>
            </div>
          </div>

          {/* Atlas Insight card */}
          <div
            className="absolute top-[20%] right-[20%] md:right-[30%] z-20 animate-float"
            style={{ animationDelay: "1s" }}
          >
            <div className="bg-[#111] border border-zinc-800 p-6 rounded-xl shadow-2xl max-w-[250px] transform rotate-6 hover:scale-105 transition-transform">
              <div className="flex items-center gap-2 mb-3 border-b border-zinc-800 pb-2">
                <Sparkles size={12} className="text-zinc-400" />
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                  Atlas Insight
                </span>
              </div>
              <p className="text-zinc-300 font-serif text-lg leading-snug italic">
                Subject &apos;Dave&apos; is observed attempting a dance move not
                seen since 1999. Crowd reaction: Mixed.
              </p>
            </div>
          </div>

          {/* Bottom-left photo */}
          <div
            className="absolute bottom-[10%] left-[5%] md:left-[15%] z-10 animate-float"
            style={{ animationDelay: "2s" }}
          >
            <div className="group bg-white p-2 shadow-xl transform -rotate-12 hover:-rotate-6 transition-transform max-w-[180px] cursor-pointer">
              <img
                src="https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=400&q=80"
                className="w-full aspect-square object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                alt="Friends laughing"
              />
              <div className="mt-2 font-mono text-[10px] text-center text-gray-500">
                3:00 AM
              </div>
            </div>
          </div>

          {/* Peak Volume pill */}
          <div
            className="absolute bottom-[25%] right-[15%] z-10 animate-float"
            style={{ animationDelay: "1.5s" }}
          >
            <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full transform -rotate-6 hover:rotate-0 transition-transform">
              <p className="text-xs font-mono text-zinc-400">
                Peak Volume: 112dB
              </p>
            </div>
          </div>

          {/* Map card */}
          <div
            className="absolute top-[5%] left-[10%] z-10 animate-float"
            style={{ animationDelay: "2.5s" }}
          >
            <div className="group bg-zinc-900 border border-zinc-800 p-1 rounded-lg transform rotate-3 hover:rotate-0 transition-transform max-w-40 cursor-pointer">
              <div className="relative overflow-hidden rounded">
                <img
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&q=80"
                  className="w-full h-24 object-cover opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-80 transition-all duration-700"
                  alt="Map"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <MapPin
                    className="text-white drop-shadow-md"
                    size={24}
                    fill="currentColor"
                  />
                </div>
              </div>
              <div className="p-2 text-[10px] font-mono text-zinc-500 text-center">
                Unknown Location
              </div>
            </div>
          </div>

          {/* Sticky note */}
          <div
            className="absolute bottom-[5%] right-[5%] z-20 animate-float"
            style={{ animationDelay: "3s" }}
          >
            <div className="bg-[#fefce8] p-4 w-40 shadow-lg transform rotate-2 hover:-rotate-2 transition-transform relative">
              <div className="w-8 h-8 rounded-full bg-black/5 absolute -top-3 left-1/2 -translate-x-1/2" />
              <p className="text-black text-sm leading-relaxed font-serif italic">
                Don&apos;t forget to send this to mom... actually, maybe
                don&apos;t.
              </p>
            </div>
          </div>

          {/* Camera polaroid */}
          <div
            className="absolute top-[10%] right-[5%] z-10 animate-float"
            style={{ animationDelay: "1.8s" }}
          >
            <div className="group bg-white p-1.5 shadow-lg transform rotate-12 hover:rotate-6 transition-transform max-w-[140px]">
              <img
                src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&q=80"
                className="w-full aspect-3/4 object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                alt="Camera"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ProtocolSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps: Step[] = [
    {
      id: "01",
      title: "Initiate",
      desc: "Host generates a time-locked frequency. One link drops into the group chat. No apps.",
      image:
        "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=500&q=80",
    },
    {
      id: "02",
      title: "Share",
      desc: "Guests upload visuals and record audio context. We capture the vibe, not just the pixels.",
      image:
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&q=80",
    },
    {
      id: "03",
      title: "Remember",
      desc: "Atlas compiles the fragments. By morning, a cohesive digital artifact is ready.",
      image:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=80",
    },
  ];

  return (
    <section className="section-snap bg-transparent py-32 relative z-10">
      <div className="max-w-6xl mx-auto px-6">
        <AnimatedSection>
          <h3 className="text-zinc-600 text-sm uppercase tracking-[0.2em] mb-20 pl-2">
            The Protocol
          </h3>
        </AnimatedSection>

        <div className="relative">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="group relative border-t border-zinc-800 py-16 transition-all duration-500 hover:bg-white/5 cursor-pointer"
              onMouseEnter={() => setActiveStep(index)}
            >
              <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-8 relative z-10">
                <div className="flex items-baseline gap-8">
                  <span
                    className={`text-xs font-mono transition-colors ${
                      activeStep === index ? "text-white" : "text-zinc-600"
                    }`}
                  >
                    ({step.id})
                  </span>
                  <h3
                    className={`text-5xl md:text-8xl font-bold transition-colors tracking-tighter ${
                      activeStep === index ? "text-white" : "text-zinc-800"
                    }`}
                  >
                    {step.title}
                  </h3>
                </div>

                {/* Accordion */}
                <div
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    activeStep === index
                      ? "max-h-24 opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="text-zinc-400 max-w-xs text-sm leading-relaxed pt-2 md:pt-0">
                    {step.desc}
                  </p>
                </div>

                <div className="md:hidden mt-4">
                  <img
                    src={step.image}
                    className="w-full h-48 object-cover rounded-lg opacity-60"
                    alt={step.title}
                  />
                </div>
              </div>
            </div>
          ))}

          <div
            className="hidden md:block absolute top-0 right-0 w-[400px] h-[500px] pointer-events-none transition-all duration-700 ease-in-out opacity-0 data-[visible=true]:opacity-100"
            style={{ transform: `translateY(${activeStep * 100}px)` }}
            data-visible={true}
          >
            <div className="relative w-full h-full p-4">
              <div className="absolute inset-0 border border-zinc-800 bg-[#0A0A0A] rounded-lg transform rotate-3 transition-transform duration-700" />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent rounded-lg z-10 opacity-60" />
              <img
                key={activeStep}
                src={steps[activeStep].image}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-90 animate-reveal-color"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const IntelligenceSection: React.FC = () => {
  return (
    <section className="section-snap bg-transparent py-32 px-6 border-t border-zinc-900/50 relative overflow-hidden z-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        {/* Left: Visual */}
        <AnimatedSection className="relative">
          <div className="relative w-full max-w-md mx-auto lg:mr-auto aspect-3/4">
            <div className="absolute inset-0 bg-zinc-800 rounded-sm overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80"
                alt="Model"
                className="w-full h-full object-cover grayscale opacity-80"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
            </div>

            {/* Floating Tag 1 */}
            <div
              className="absolute top-[20%] -left-5 md:-left-10 flex items-center gap-2 animate-float"
              style={{ animationDelay: "0s" }}
            >
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-xs text-zinc-300 shadow-xl flex items-center gap-2">
                <Scan size={12} className="text-zinc-500" /> Movement
              </div>
              <div className="w-10 h-px bg-white/20" />
            </div>

            {/* Floating Tag 2 */}
            <div
              className="absolute bottom-[30%] -right-2.5 md:right-[-30px] flex items-center gap-2 flex-row-reverse animate-float"
              style={{ animationDelay: "1.5s" }}
            >
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-xs text-zinc-300 shadow-xl flex items-center gap-2">
                <Sparkles size={12} className="text-zinc-500" /> Sentiment: Joy
              </div>
              <div className="w-12 h-px bg-white/20" />
            </div>

            {/* Floating Tag 3 (Palette) */}
            <div
              className="absolute bottom-8 left-4 flex items-center gap-2 animate-float"
              style={{ animationDelay: "2.5s" }}
            >
              <div className="bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-full text-xs text-zinc-300 shadow-xl flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-3 h-3 rounded-full bg-[#d4d4d8]" />
                  <div className="w-3 h-3 rounded-full bg-[#52525b]" />
                  <div className="w-3 h-3 rounded-full bg-[#27272a]" />
                </div>
              </div>
            </div>

            <div className="absolute inset-0 border border-white/5 pointer-events-none">
              <div className="absolute top-1/3 left-0 w-full h-px bg-white/5" />
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/5" />
            </div>
          </div>
        </AnimatedSection>

        {/* Right: Text */}
        <AnimatedSection delay={200}>
          <div className="max-w-lg">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-8 leading-[0.9] tracking-tighter">
              AI-powered <br />
              <span className="font-serif italic text-zinc-500">
                intelligence.
              </span>
            </h2>
            <p className="text-lg text-zinc-400 leading-relaxed mb-8">
              Atlas uses computer vision to automatically tag every element. You
              don&apos;t have to describe the scene; we see the laughter, the
              lighting, and the details that the eye might miss.
            </p>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-xs uppercase tracking-widest">
                Object Detection
              </div>
              <div className="px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-xs uppercase tracking-widest">
                Mood Analysis
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

const Footer: React.FC = () => (
  <footer className="section-snap relative bg-[#050505] pt-20 pb-12 px-6 overflow-hidden border-t border-zinc-900 z-10">
    <div className="max-w-7xl mx-auto relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-end pt-8">
        <div className="flex items-center gap-2 text-zinc-600 mb-6 md:mb-0">
          <Disc size={16} className="animate-spin-slow" />
          <span className="text-xs font-mono uppercase tracking-widest">
            Atlas Systems &copy; 2025
          </span>
        </div>

        <div className="text-right">
          <div className="flex justify-end gap-6 text-zinc-500 text-sm font-mono uppercase tracking-wider mb-12">
            <a href="#" className="hover:text-white transition-colors">
              Twitter
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Manifesto
            </a>
          </div>
          <p className="text-zinc-800 text-[12vw] font-bold leading-none -mb-4 select-none opacity-20 hover:opacity-100 transition-opacity duration-700">
            ATLAS
          </p>
        </div>
      </div>
    </div>
  </footer>
);

export default function AtlasPage() {
  return (
    <div className="bg-[#050505] min-h-screen w-full selection:bg-zinc-700 selection:text-white font-sans relative text-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        html {
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
        }
        .section-snap {
          scroll-snap-align: start;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        @keyframes revealColor {
          0% { filter: grayscale(100%) contrast(100%); opacity: 0.6; }
          100% { filter: grayscale(0%) saturate(50%) contrast(110%); opacity: 0.9; }
        }
        .animate-reveal-color {
          animation: revealColor 3s ease-out forwards;
        }
      `,
        }}
      />

      <ImmersiveBackground />
      <Navigation />
      <Hero />
      <AlchemySection />
      <ScrapbookSection />
      <ProtocolSection />
      <IntelligenceSection />
      <Footer />
    </div>
  );
}
