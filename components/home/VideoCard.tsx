import Link from "next/link";
import { publicConfig } from "@/lib/config.public";
import { t } from "@/messages/en";
import type { VideoFeedItem } from "@/types/api";

const PLACEHOLDER = "/images/video-placeholder.jpg";

interface VideoCardProps {
  item: VideoFeedItem;
}

export function VideoCard({ item }: VideoCardProps) {
  const imgSrc = item.coverImageKey ? `${publicConfig.mediaCdnUrl}/${item.coverImageKey}` : PLACEHOLDER;

  return (
    <Link
      href={`/?video=${item.id}`}
      aria-label={t("home.video_card_label", { title: item.title })}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={item.title}
          loading="lazy"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px"
          className="h-full w-full object-cover transition group-hover:scale-105"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
        />
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white text-xl">
            &#9654;
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="line-clamp-2 text-base font-bold text-gray-900">{item.title}</h2>
        <div className="mt-auto flex gap-3 pt-2 text-xs text-gray-400">
          <span aria-label={t("articles.card.likes", { count: String(item.likeCount) })}>
            {item.likeCount}
          </span>
          <span aria-label={t("articles.card.comments", { count: String(item.commentCount) })}>
            {item.commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
