import type { Video, ThumbnailSource, VideoStatus } from "@/types/video";

export type VideoRow = {
  id: string;
  youtube_id: string;
  title: string;
  description: string | null;
  category_id: string;
  thumbnail_key: string;
  thumbnail_source: string;
  locale: string;
  status: string;
  published_at: string | null;
  updated_at: string;
  created_at: string;
};

export function mapRow(row: VideoRow): Video {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    thumbnailKey: row.thumbnail_key,
    thumbnailSource: row.thumbnail_source as ThumbnailSource,
    locale: row.locale,
    status: row.status as VideoStatus,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}
