// S-053: Videos backend contract.
// Backend defines; frontend consumes (S-056 editor block, S-063 admin screen, S-068 popup).

export type VideoStatus = "draft" | "published" | "hidden";
export type ThumbnailSource = "youtube_copy" | "custom";

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  categoryId: string;
  thumbnailKey: string;
  thumbnailSource: ThumbnailSource;
  locale: string;
  status: VideoStatus;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Returned by getPublishedVideo — visible fields only, no admin data */
export interface PublicVideo {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnailKey: string;
  categoryId: string;
}

export interface AddVideoInput {
  youtubeLink: string;
  title: string;
  description?: string | null;
  categoryId: string;
  customThumbnailMediaId?: string | null;
}

export type AddVideoErrorCode =
  | "not_allowed"
  | "validation_failed"
  | "unknown";

export type AddVideoResult =
  | { ok: true; video: Video; thumbnailWarning?: string }
  | { ok: false; code: AddVideoErrorCode; field?: string };

export interface UpdateVideoInput {
  id: string;
  title?: string;
  description?: string | null;
  categoryId?: string;
  customThumbnailMediaId?: string | null;
  updatedAt: string;
}

export type UpdateVideoErrorCode =
  | "not_allowed"
  | "validation_failed"
  | "not_found"
  | "version_conflict"
  | "unknown";

export type UpdateVideoResult =
  | { ok: true; video: Video }
  | { ok: false; code: UpdateVideoErrorCode; field?: string };

export type VideoStatusAction = "publish" | "hide" | "unhide" | "delete";

export interface SetVideoStatusInput {
  id: string;
  action: VideoStatusAction;
  publishedAt?: string | null;
  updatedAt: string;
}

export type SetVideoStatusErrorCode =
  | "not_allowed"
  | "validation_failed"
  | "not_found"
  | "version_conflict"
  | "purge_failed"
  | "unknown";

export type SetVideoStatusResult =
  | { ok: true; video: Video }
  | { ok: false; code: SetVideoStatusErrorCode; field?: string };

/** Used by the article editor video picker (S-056). */
export interface PickerItem {
  id: string;
  title: string;
  thumbnailKey: string;
  kind: "video";
}

export interface ListPickerItemsInput {
  kind: "video";
  search?: string;
  page?: number;
}

export type ListPickerItemsResult =
  | { ok: true; items: PickerItem[]; hasMore: boolean }
  | { ok: false; code: "not_allowed" | "unknown" };

export interface ListAdminVideosInput {
  status?: VideoStatus | "scheduled";
  page?: number;
}

export type AdminVideoRow = Video & {
  computedStatus: VideoStatus | "scheduled";
};

export type ListAdminVideosResult =
  | { ok: true; videos: AdminVideoRow[]; hasMore: boolean }
  | { ok: false; code: "not_allowed" | "unknown" };

export type GetPublicVideoResult =
  | { ok: true; video: PublicVideo }
  | { ok: false; code: "not_found" };
