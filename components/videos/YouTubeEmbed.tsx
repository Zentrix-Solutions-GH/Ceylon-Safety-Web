"use client";

import { useState } from "react";
import { t } from "@/messages/en";
import { YOUTUBE_ID_RE } from "@/lib/youtube";
const PLACEHOLDER = "/images/video-placeholder.jpg";

interface YouTubeEmbedProps {
  youtubeId: string;
  thumbnailUrl: string | undefined;
  title: string;
}

export function YouTubeEmbed({ youtubeId, thumbnailUrl, title }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);

  const idValid = YOUTUBE_ID_RE.test(youtubeId);
  const thumb = thumbnailUrl || PLACEHOLDER;

  if (!idValid) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt={title} className="h-full w-full object-cover opacity-30" />
      </div>
    );
  }

  if (playing) {
    const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          title="YouTube player"
          src={src}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms allow-pointer-lock"
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt={title} className="h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          aria-label={t("video.play_button", { title })}
          onClick={() => setPlaying(true)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <span aria-hidden="true" className="ml-1 text-2xl">&#9654;</span>
        </button>
        <p className="text-xs text-white/80 drop-shadow">{t("video.loads_youtube")}</p>
      </div>
    </div>
  );
}
