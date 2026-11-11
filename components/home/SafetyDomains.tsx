import Link from "next/link";

const DOMAINS = [
  {
    label: "Fire Safety",
    slug: "fire-safety",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2C8.5 7 6 9.5 6 13a6 6 0 0012 0c0-3.5-2.5-6-6-11zM12 17.5c-1.4 0-2.5-1.1-2.5-2.5 0-1 .6-1.8 1.5-2.5.2 1.5 1 2.5 2 2.5.3 0 .5-.1.8-.2-.3.4-.6.7-1.8.7z" />
      </svg>
    ),
  },
  {
    label: "First Aid & CPR",
    slug: "first-aid",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 13h-2v-4H7v-2h4V5h2v4h4v2h-4v4z" />
      </svg>
    ),
  },
  {
    label: "Electrical Safety",
    slug: "electrical-safety",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M7 2v11h3v9l7-12h-4l4-8z" />
      </svg>
    ),
  },
  {
    label: "Construction",
    slug: "construction",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M13.78 15.3L19.78 21.3L21.89 19.14L15.89 13.14L13.78 15.3M17.5 11.5C18 11.5 18.5 11.4 19 11.2L15.5 7.7L16.56 6.63C17.08 7.09 17.74 7.5 18.5 7.5C19.88 7.5 21 6.38 21 5C21 4.62 20.9 4.26 20.72 3.95L18.5 6.17L17.33 5L19.55 2.78C19.24 2.6 18.88 2.5 18.5 2.5C17.12 2.5 16 3.62 16 5C16 5.26 16.05 5.5 16.12 5.74L14.37 4L13 5.37L14.76 7.13C14.5 7.07 14.26 7 14 7C12.62 7 11.5 8.12 11.5 9.5C11.5 9.76 11.55 10 11.62 10.24L2 20.0V22H4L10.26 15.74C10.5 15.9 10.76 16 11 16C11.26 16 11.5 15.9 11.74 15.74L13.26 17.26C12.74 17.74 12.5 18.38 12.5 19C12.5 20.38 13.62 21.5 15 21.5C16.38 21.5 17.5 20.38 17.5 19C17.5 17.74 16.62 16.74 15.5 16.5L13.74 14.74L14.26 14.26L17.5 11.5Z" />
      </svg>
    ),
  },
  {
    label: "Food Hygiene",
    slug: "food-hygiene",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-8-15.03-8-15.03 0h15.03zm-1.98-1.69c-.07.09-.23.07-.23-.04v-.05c0-1.42-.95-2.5-2.14-2.5H7.17c-1.19 0-2.14 1.08-2.14 2.5v.05c0 .11-.16.13-.23.04-.29-.38-.46-.9-.46-1.46 0-1.5 1.14-2.72 2.55-2.72h7.08c1.41 0 2.55 1.22 2.55 2.72 0 .56-.17 1.08-.46 1.46z" />
      </svg>
    ),
  },
  {
    label: "Chemical & Hazmat",
    slug: "chemical-industrial",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M7 2v2h1v14c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V4h1V2H7zm4 14H9l3-5v5zm2-7l-3 5V9h2l-2 3h3l-2 4V9h2z" />
      </svg>
    ),
  },
  {
    label: "Ergonomics",
    slug: "ergonomics",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2C10.9 2 10 2.9 10 4s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-1 20h2v-5.5l2.5 4.5H17l-3-5.5V13h-4v2.5L7 21h1.5L11 16.5V22zm1-10c-1.1 0-2 .9-2 2v3h4v-3c0-1.1-.9-2-2-2z" />
      </svg>
    ),
  },
  {
    label: "Occupational Health",
    slug: "occupational-health",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
        <path d="M12 2C9.24 2 7 4.24 7 7c0 1.59.71 3.01 1.83 3.97C5.5 12.44 3 15.52 3 19h2c0-3.09 2.5-5.5 5.5-5.5.5 0 1 .07 1.46.18C10.74 14.46 10 15.65 10 17c0 2.21 1.79 4 4 4s4-1.79 4-4-1.79-4-4-4c-.22 0-.44.02-.65.05.18-.45.28-.93.28-1.44C13.63 10.14 14 8.59 14 7c0-2.76-2.24-5-5-5zm2 15c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
      </svg>
    ),
  },
];

export function SafetyDomains() {
  return (
    <section className="bg-white py-12 border-y border-gray-100">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-1 text-center text-xl font-bold text-gray-900">Explore Safety Domains</h2>
        <p className="mb-8 text-center text-sm text-gray-500">
          Based on locally-critical workplace occupational safety guidance
        </p>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {DOMAINS.map((d) => (
            <Link
              key={d.slug}
              href={`/articles?category=${encodeURIComponent(d.slug)}`}
              className="group flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-2 py-5 text-center hover:border-[#C00000]/20 hover:bg-red-50 transition-colors"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-[#C00000] group-hover:bg-red-200 transition-colors">
                {d.icon}
              </div>
              <span className="text-xs font-medium text-gray-700 group-hover:text-[#C00000] leading-tight">{d.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
