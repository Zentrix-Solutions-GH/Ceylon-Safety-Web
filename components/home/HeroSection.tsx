import Link from "next/link";
import { Search } from "lucide-react";
import { HeroSlideshow } from "./HeroSlideshow";

export function HeroSection() {
  return (
    /* Extra pb-8 reserves space so the search bar (which overflows by 50%) isn't clipped */
    <section className="relative overflow-visible bg-[#1a1a1a] min-h-[560px] flex flex-col pb-8">
      {/* Animated slideshow background — clipped to the section */}
      <div className="absolute inset-0 overflow-hidden">
        <HeroSlideshow />
      </div>

      {/* Text + buttons */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-14 pb-10">
        <div className="max-w-xl">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-4 py-1.5 text-[11px] font-bold text-[#C00000] uppercase tracking-widest shadow-sm backdrop-blur-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 shrink-0 text-[#C00000]">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            Safety First, Every Day
          </div>

          <h1 className="mb-4 text-4xl font-black text-white leading-tight sm:text-5xl">
            Learn. Stay Safe.<br />Get Certified.
          </h1>

          <p className="mb-6 text-sm text-white/70 leading-relaxed max-w-sm">
            Sri Lanka&apos;s trusted national portal for accredited OSHA &amp; SLS occupational health and safety training,
            statutory audit templates and registered industrial consultants.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#C00000] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#a00000] transition-colors shadow-lg shadow-red-900/30"
            >
              Explore Articles →
            </Link>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
              </svg>
              Browse Documents
            </Link>
          </div>
        </div>
      </div>

      {/* Search bar — positioned at the bottom edge, translated down 50% to straddle the section boundary */}
      <div className="absolute bottom-0 left-0 right-0 z-20 translate-y-1/2 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex overflow-hidden rounded-full border border-gray-200 bg-white shadow-2xl">
            <div className="flex flex-1 items-center gap-2 px-5 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                type="search"
                placeholder="Search safety guidelines, audit templates..."
                className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
              />
            </div>
            <div className="border-l border-gray-200">
              <select className="h-full border-0 bg-transparent px-4 text-sm text-gray-600 focus:outline-none pr-8">
                <option value="">All Categories | Construction, Fire, Electrical...</option>
                <option value="fire">Fire Safety</option>
                <option value="construction">Construction</option>
                <option value="chemical">Chemical &amp; Industrial</option>
                <option value="electrical">Electrical Safety</option>
                <option value="ergonomics">Ergonomics</option>
              </select>
            </div>
            <button
              type="button"
              className="whitespace-nowrap rounded-r-full bg-[#C00000] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#a00000] transition-colors tracking-wide"
            >
              FIND RESOURCES
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
