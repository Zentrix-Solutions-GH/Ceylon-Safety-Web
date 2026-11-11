"use client";

import { publicConfig } from "@/lib/config.public";
import { t } from "@/messages/en";

export type VideoBlockStatus = "ready" | "hidden" | "deleted";

interface VideoBlockProps {
  videoId: string;
  title: string;
  thumbnailKey: string;
  status: VideoBlockStatus;
  onRemove: () => void;
}

export default function VideoBlock({ title, thumbnailKey, status, onRemove }: VideoBlockProps) {
  if (status === "deleted") return null;

  const thumbSrc = `${publicConfig.mediaCdnUrl}/${thumbnailKey}`;

  return (
    <figure className="video-block">
      {status === "hidden" && (
        <p role="alert" className="video-block__warning">
          {t("editor.video.hidden_warning")}
        </p>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbSrc} alt={title} className="video-block__thumbnail" />
      <figcaption className="video-block__title">{title}</figcaption>
      <button
        type="button"
        aria-label={t("editor.video.remove")}
        className="video-block__remove"
        onClick={onRemove}
      >
        {t("editor.video.remove")}
      </button>
    </figure>
  );
}
