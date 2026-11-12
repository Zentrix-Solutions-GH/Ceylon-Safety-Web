"use client";

import { useEffect, useReducer } from "react";
import Image from "next/image";
import { t } from "@/messages/en";
import { publicConfig } from "@/lib/config.public";

const SLIDES = [
  { srcPath: "/home/hero-slide-1.jpg", altKey: "home.hero.slide1_alt" as const },
  { srcPath: "/home/hero-slide-2.jpg", altKey: "home.hero.slide2_alt" as const },
  { srcPath: "/home/hero-slide-3.jpg", altKey: "home.hero.slide3_alt" as const },
  { srcPath: "/home/hero-slide-4.jpg", altKey: "home.hero.slide4_alt" as const },
];

const INTERVAL_MS = 4500;

type State = { current: number; prev: number | null };
type Action = { type: "ADVANCE"; to?: number } | { type: "DONE" };

function reducer(s: State, a: Action): State {
  if (a.type === "ADVANCE") {
    const next = a.to !== undefined ? a.to : (s.current + 1) % SLIDES.length;
    if (next === s.current) return s;
    return { current: next, prev: s.current };
  }
  return { ...s, prev: null };
}

export function HeroSlideshow() {
  const [{ current, prev }, dispatch] = useReducer(reducer, { current: 0, prev: null });

  // Auto-advance
  useEffect(() => {
    const timer = setInterval(() => dispatch({ type: "ADVANCE" }), INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Clear prev after fade completes (1 s)
  useEffect(() => {
    if (prev === null) return;
    const id = setTimeout(() => dispatch({ type: "DONE" }), 1000);
    return () => clearTimeout(id);
  }, [prev]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Render all slides; current fades in, prev fades out, rest stay hidden */}
      {SLIDES.map((slide, i) => {
        const isCurrent = i === current;
        return (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              isCurrent ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={`${publicConfig.mediaCdnUrl}${slide.srcPath}`}
              alt={t(slide.altKey)}
              fill
              className="object-cover object-center opacity-40"
              unoptimized
              priority={i === 0}
            />
          </div>
        );
      })}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />

      {/* Dot indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={t("home.hero.slide_indicator", { n: String(i + 1) })}
            onClick={() => dispatch({ type: "ADVANCE", to: i })}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-6 bg-white" : "w-1.5 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
