import "server-only";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { ResolvedVideoNode, ResolvedDocumentNode, RefTargetStatus } from "@/types/article";

export interface RawRef {
  ref_type: string;
  ref_id: string;
  node_id: string;
  phrase: string | null;
}

// Videos table is not publicly readable — always uses service-role for the lookup.
export async function resolveArticleRefs(rawRefs: RawRef[]): Promise<{
  resolvedVideos: ResolvedVideoNode[];
  resolvedDocuments: ResolvedDocumentNode[];
}> {
  const supabase = createSupabaseServiceRoleClient();

  const videoRefIds = rawRefs.filter((r) => r.ref_type === "video").map((r) => r.ref_id);
  const videoStatusMap = new Map<string, string>();
  if (videoRefIds.length > 0) {
    const { data: videos } = await supabase
      .from("videos")
      .select("id, status")
      .in("id", videoRefIds);
    if (videos) {
      for (const v of videos as Array<{ id: string; status: string }>) {
        videoStatusMap.set(v.id, v.status);
      }
    }
  }

  const resolvedVideos: ResolvedVideoNode[] = rawRefs
    .filter((r) => r.ref_type === "video")
    .map((r) => {
      const videoStatus = videoStatusMap.get(r.ref_id);
      const status: RefTargetStatus =
        videoStatus === "published"
          ? "published"
          : videoStatus === "hidden"
          ? "hidden"
          : videoStatus === "deleted"
          ? "deleted"
          : "not_found";
      return { nodeId: r.node_id, videoId: r.ref_id, status };
    });

  const resolvedDocuments: ResolvedDocumentNode[] = rawRefs
    .filter((r) => r.ref_type === "document")
    .map((r) => ({ nodeId: r.node_id, documentId: r.ref_id, status: "not_shown" as const }));

  return { resolvedVideos, resolvedDocuments };
}
