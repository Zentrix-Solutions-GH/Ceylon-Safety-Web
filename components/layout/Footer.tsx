"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { t } from "@/messages/en";
import type { MessageKey } from "@/messages/en";

export interface FooterSettings {
  contact_email?: string | null;
  contact_phone?: string | null;
  footer_address?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_linkedin?: string | null;
  social_youtube?: string | null;
}

export interface FooterCategory {
  name: string;
  slug: string;
}

interface FooterProps {
  settings?: FooterSettings | null;
  categories?: FooterCategory[];
}

const QUICK_LINKS: { label: string; href: string }[] = [
  { label: "Knowledge", href: "/articles" },
  { label: "Articles & Case Studies", href: "/articles" },
  { label: "Document & AI Template", href: "/documents" },
  { label: "Accreditations & Courses", href: "/courses" },
  { label: "Contact Us", href: "/contact-coach" },
  { label: "Certification Portal (SLS)", href: "/certifications" },
];

const INDUSTRY_SECTORS: { label: string; href: string }[] = [
  { label: "Construction Safety", href: "/articles?category=construction" },
  { label: "Industrial/Manufacturing", href: "/articles?category=industrial" },
  { label: "Logistics Safety Protocols", href: "/articles?category=logistics" },
  { label: "Healthcare & Hospitality", href: "/articles?category=healthcare" },
  { label: "Agriculture & Tea Estates", href: "/articles?category=agriculture" },
];

// LinkedIn SVG
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// YouTube SVG
function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Facebook SVG
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

// Instagram SVG
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export default function Footer({ settings, categories: _categories = [] }: FooterProps) {
  const year = new Date().getFullYear();
  const btnRef = useRef<HTMLButtonElement>(null);

  function handleCookieSettings() {
    window.dispatchEvent(
      new CustomEvent("open-cookie-banner", { detail: { trigger: btnRef.current } })
    );
  }

  const address = settings?.footer_address ?? "No. XX, Wennawatta Road, Nugegoda, Sri Lanka";
  const phone = settings?.contact_phone ?? "+94 9 266 6630";
  const email = settings?.contact_email ?? "support@ceylonsafety.lk";

  return (
    <footer aria-label={t("footer.label")} className="bg-[#1a1a1a] text-white">

      {/* Top section — brand + newsletter */}
      <div className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="mb-3 flex items-center gap-2.5">
              <Image src="/logo.jpg" alt="Ceylon Safety" width={36} height={36} className="rounded" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-white tracking-wide">CEYLON</p>
                <p className="text-sm font-bold text-[#C00000] tracking-wide">SAFETY</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 uppercase tracking-widest mb-3">
              Sri Lanka&apos;s National Safety Hub
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              CeylonSafety is advancing occupational health, environmental protection and industrial safety compliance standards across civil construction, apparel manufacturing, tea estates, and ports in Sri Lanka.
            </p>
            {/* Social icons */}
            <div className="mt-4 flex items-center gap-2">
              {[
                { href: settings?.social_linkedin ?? "#", icon: <LinkedInIcon />, label: "LinkedIn" },
                { href: settings?.social_youtube ?? "#", icon: <YouTubeIcon />, label: "YouTube" },
                { href: settings?.social_facebook ?? "#", icon: <FacebookIcon />, label: "Facebook" },
                { href: settings?.social_instagram ?? "#", icon: <InstagramIcon />, label: "Instagram" },
              ].map(({ href, icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-gray-300 hover:bg-[#C00000] hover:text-white transition-colors"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Newsletter */}
          <div className="lg:max-w-sm w-full">
            <h3 className="mb-1 text-base font-bold text-white">
              Stay Updated on Sri Lanka Statutory Safety Changes
            </h3>
            <p className="mb-4 text-xs text-gray-400">
              Receive timely Safety digest delivered the latest from Sri Lanka in the Standard industry specific updates
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex overflow-hidden rounded-md border border-white/20">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 bg-[#C00000] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#a00000] transition-colors tracking-wider"
              >
                SUBSCRIBE
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Links grid */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Quick Links</h4>
            <ul className="space-y-2">
              {QUICK_LINKS.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-xs text-gray-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Industry Sectors */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Industry Sectors</h4>
            <ul className="space-y-2">
              {INDUSTRY_SECTORS.map((l) => (
                <li key={l.href + l.label}>
                  <Link href={l.href} className="text-xs text-gray-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Headquarters */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Headquarters</h4>
            <ul className="space-y-3 text-xs text-gray-400">
              <li className="flex gap-2">
                <span className="mt-0.5 shrink-0">📍</span>
                <span>{address}</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">📞</span>
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-white transition-colors">{phone}</a>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">✉️</span>
                <a href={`mailto:${email}`} className="hover:text-white transition-colors break-all">{email}</a>
              </li>
            </ul>
          </div>

          {/* Accreditation Affiliates */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Accreditation Affiliates</h4>
            <p className="mb-3 text-xs text-gray-400 leading-relaxed">
              CeylonSafety content is reviewed against OSHA international and SLS standards and by registered safety professionals in Sri Lanka.
            </p>
            <Link
              href="/certifications"
              className="inline-block rounded border border-[#C00000] px-3 py-1.5 text-[11px] font-semibold text-[#C00000] hover:bg-[#C00000] hover:text-white transition-colors"
            >
              Get Registered Online
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
          <span>&copy; {year} Ceylon Safety. All Rights Reserved | Designed &amp; Developed by{" "}
            <a href="https://zentrixsolution.tech" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white underline">
              Zentrix Solutions
            </a>
          </span>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <button ref={btnRef} type="button" onClick={handleCookieSettings} className="hover:text-gray-300 transition-colors">
              Cookie Policy
            </button>
            <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms &amp; Conditions</Link>
            <Link href="/sitemap" className="hover:text-gray-300 transition-colors">Site Map</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
