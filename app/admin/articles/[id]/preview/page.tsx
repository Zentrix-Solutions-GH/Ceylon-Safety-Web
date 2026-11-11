import type { Metadata } from "next";
import { renderPreviewOrRedirect } from "./renderPreviewOrRedirect";
import PreviewPageInner from "./PreviewPageInner";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const fetchCache = "force-no-store";

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await renderPreviewOrRedirect(id);
  return <PreviewPageInner data={data} />;
}
