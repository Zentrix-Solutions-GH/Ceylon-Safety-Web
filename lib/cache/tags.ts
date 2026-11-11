export const ANNOUNCEMENT_TAG = "announcement-banner";
export const FEED_TAG = "feed-api";
export const DOCUMENTS_NOT_FOUND_TAG = "documents-not-found";
export const HOME_FIRST_PAGE_TAG = "home-first-page";
export const COUNTERS_TAG = "counters";
export const SITEMAP_TAG = "sitemap";
export const ARTICLES_LIST_TAG = "articles-list";
export const DOCUMENTS_LIST_TAG = "documents-list";
export function documentTag(documentId: string): string {
  return `document:${documentId}`;
}
