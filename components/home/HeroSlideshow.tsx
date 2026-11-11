"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&q=80",
    alt: "Construction site safety",
  },
  {
    src: "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=1920&q=80",
    alt: "Industrial safety workers",
  },
  {
    src: "https://images.unsplash.com/photo-1565688534245-05d6b5be184a?w=1920&q=80",
    alt: "Fire safety equipment",
  },
  {
    src: "https://images.unsplash.com/photo-1612178537253-bccd437b730e?w=1920&q=80",
    alt: "Electrical safety inspection",
  },
];

const INTERVAL_MS = 4500;

export function HeroSlideshow() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => {
        setPrev(c);
        setAnimating(true);
        return (c + 1) % SLIDES.length;
      });
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Clear "prev" once fade-in completes (duration 1000ms)
  useEffect(() => {
    if (!animating) return;
    const t = setTimeout(() => {
      setPrev(null);
      setAnimating(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [animating, current]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Previous slide — fades out */}
      {prev !== null && (
        <div
          key={`prev-${prev}`}
          className="absolute inset-0 transition-opacity duration-1000 opacity-0"
        >
          <Image
            src={SLIDES[prev].src}
            alt={SLIDES[prev].alt}
            fill
            className="object-cover object-center opacity-40"
            unoptimized
          />
        </div>
      )}

      {/* Current slide — fades in */}
      <div
        key={`cur-${current}`}
        className={`absolute inset-0 transition-opacity duration-1000 ${animating ? "opacity-100" : "opacity-100"}`}
        style={{ animation: animating ? "heroFadeIn 1s ease-in-out" : undefined }}
      >
        <Image
          src={SLIDES[current].src}
          alt={SLIDES[current].alt}
          fill
          className="object-cover object-center opacity-40"
          unoptimized
          priority={current === 0}
        />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => {
              setPrev(current);
              setAnimating(true);
              setCurrent(i);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>

      <style>{`
        @keyframes heroFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
