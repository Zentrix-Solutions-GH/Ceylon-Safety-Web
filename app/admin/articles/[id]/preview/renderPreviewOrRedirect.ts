// Stub — full implementation in S-058
import { redirect } from "next/navigation";
import { getArticlePreview } from "@/lib/articles/getArticlePreview";

export async function renderPreviewOrRedirect(id: string): Promise<never> {
  const result = await getArticlePreview(id);
  if (!result.ok && result.code === "not_allowed") {
    redirect("/admin");
  }
  throw new Error(`preview not implemented: ${id}`);
}
