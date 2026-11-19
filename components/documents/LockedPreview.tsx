import Image from "next/image";
import { publicUrl } from "@/lib/media/publicUrl";
import { t } from "@/messages/en";

interface Props {
  coverImageKey: string | null;
  title: string;
}

export default function LockedPreview({ coverImageKey, title }: Props) {
  if (!coverImageKey) {
    return (
      <div className="relative w-full" style={{ paddingTop: "14px", paddingRight: "14px" }} data-testid="locked-preview-placeholder">
        <div className="relative h-64 w-full">
          {/* Page 3 — back */}
          <div
            className="absolute inset-0 rounded-xl bg-slate-200 border border-slate-300 shadow-md"
            aria-hidden="true"
            style={{ transform: "translate(14px,-14px) rotate(3deg)", transformOrigin: "bottom left" }}
          />
          {/* Page 2 — middle */}
          <div
            className="absolute inset-0 rounded-xl bg-muted/80 border border-slate-200 shadow-lg"
            aria-hidden="true"
            style={{ transform: "translate(7px,-7px) rotate(1.5deg)", transformOrigin: "bottom left" }}
          />
          {/* Page 1 — front */}
          <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/60 shadow-xl">
            <div className="absolute inset-0 flex flex-col justify-evenly py-5 opacity-10" aria-hidden="true">
              {[0,1,2,3,4,5].map((i) => (
                <div key={i} className="border-b border-foreground" />
              ))}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-muted-foreground opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="mt-2 text-xs font-medium text-muted-foreground opacity-50">{t("locked_preview.placeholder_alt")}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    /*
     * Wrapper creates 14px breathing room at the top and right so the back
     * pages (translated outward) are visible and not clipped by the column.
     */
    <div className="relative w-full" style={{ paddingTop: "14px", paddingRight: "14px" }}>
      <div className="relative h-64 w-full">

        {/* Page 3 — back, plain paper */}
        <div
          className="absolute inset-0 rounded-xl bg-slate-200 border border-slate-300 shadow-md"
          aria-hidden="true"
          style={{ transform: "translate(14px,-14px) rotate(3deg)", transformOrigin: "bottom left" }}
        />

        {/* Page 2 — middle, heavily blurred cover */}
        <div
          className="absolute inset-0 overflow-hidden rounded-xl border border-slate-200 shadow-lg"
          aria-hidden="true"
          style={{ transform: "translate(7px,-7px) rotate(1.5deg)", transformOrigin: "bottom left" }}
        >
          <Image
            src={publicUrl(coverImageKey)}
            alt=""
            fill
            className="object-cover blur-2xl brightness-40 scale-110 select-none pointer-events-none"
            sizes="560px"
            draggable={false}
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Page 1 — front, locked preview */}
        <div className="absolute inset-0 overflow-hidden rounded-xl shadow-2xl">
          <Image
            src={publicUrl(coverImageKey)}
            alt=""
            fill
            className="object-cover blur-sm brightness-60 scale-105 select-none pointer-events-none"
            sizes="(max-width: 768px) 100vw, 560px"
            draggable={false}
          />

          {/* Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" aria-hidden="true" />

          {/* Lock badge */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="rounded-full bg-white/15 p-4 backdrop-blur-md border border-white/25 shadow-2xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-9 w-9 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-5 py-1.5 text-xs font-bold text-white tracking-widest uppercase shadow-lg">
              {t("locked_preview.purchase_to_unlock")}
            </span>
          </div>

          {/* Page dots at bottom */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5" aria-hidden="true">
            {[0,1,2].map((i) => (
              <div key={i} className={`rounded-full ${i === 0 ? "w-5 h-1.5 bg-white/80" : "w-1.5 h-1.5 bg-white/30"}`} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
