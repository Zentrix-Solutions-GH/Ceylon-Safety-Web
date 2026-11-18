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
        className="flex h-48 w-full items-center justify-center rounded-lg bg-muted"
        aria-label={t("locked_preview.placeholder_alt")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-lg">
      <Image
        src={publicUrl(coverImageKey)}
        alt={t("locked_preview.alt", { title })}
        fill
        className="object-cover blur-sm brightness-75 select-none pointer-events-none"
        sizes="(max-width: 768px) 100vw, 480px"
        draggable={false}
      />
      {/* Lock icon overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-white drop-shadow"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
    </div>
  );
}
