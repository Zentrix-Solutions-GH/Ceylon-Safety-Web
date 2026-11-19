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
      <div
        data-testid="locked-preview-placeholder"
        className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/60"
        aria-label={t("locked_preview.placeholder_alt")}
      >
        {/* Decorative lines */}
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border-b border-foreground" style={{ marginTop: `${i * 36 + 16}px` }} />
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs font-medium opacity-50">{t("locked_preview.placeholder_alt")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-xl">
      {/* Blurred background image */}
      <Image
        src={publicUrl(coverImageKey)}
        alt={t("locked_preview.alt", { title })}
        fill
        className="object-cover blur-md brightness-50 scale-110 select-none pointer-events-none"
        sizes="(max-width: 768px) 100vw, 560px"
        draggable={false}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

      {/* Lock badge */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="rounded-full bg-white/10 p-4 backdrop-blur-sm border border-white/20 shadow-xl">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span className="rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1 text-xs font-semibold text-white tracking-wide uppercase">
          {t("locked_preview.purchase_to_unlock")}
        </span>
      </div>
    </div>
  );
}
