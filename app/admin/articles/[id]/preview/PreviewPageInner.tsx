// Stub — full implementation in S-058
import type { ArticlePreviewData } from "@/types/article";

export default function PreviewPageInner({ data }: { data: ArticlePreviewData }) {
  return (
    <div>
      <div data-testid="preview-banner">Preview</div>
      <h1>{data.title}</h1>
      {data.coverImageKey && data.coverImageStatus === "pending" && (
        <div data-testid="cover-image-pending-notice">Cover image pending</div>
      )}
    </div>
  );
}
