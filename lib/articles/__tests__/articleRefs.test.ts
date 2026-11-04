// S-048: article_refs rebuild — AC4/EC9

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: { supabaseServiceRoleKey: "srk" },
  publicConfig: { supabaseUrl: "https://test.supabase.co", supabaseAnonKey: "anon" },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  requireStaff: vi.fn(),
}));
vi.mock("@/lib/audit/index", () => ({
  writeAuditRow: vi.fn(),
  writeDenied: vi.fn(),
}));
vi.mock("@/lib/cache/purge", () => ({
  purgeArticle: vi.fn().mockResolvedValue({ ok: true }),
}));

import { buildArticleRefs } from "@/lib/articles/articleRefs";
import { SCHEMA_VERSION } from "@/lib/content/schema";

const VIDEO_ID = "ee000001-0000-4000-8000-000000000001";
const DOCUMENT_ID = "ff000001-0000-4000-8000-000000000001";
const COURSE_ID = "gg000001-0000-4000-8000-000000000001";
const MEDIA_ID = "hh000001-0000-4000-8000-000000000001";

describe("buildArticleRefs", () => {
  it("extracts video refs from body", () => {
    const body = {
      schema_version: SCHEMA_VERSION,
      type: "doc",
      content: [{ type: "video", attrs: { node_id: "v1", video_id: VIDEO_ID } }],
    };
    const refs = buildArticleRefs(body, "cover-key");
    const videoRef = refs.find(r => r.ref_type === "video");
    expect(videoRef).toBeDefined();
    expect(videoRef?.ref_id).toBe(VIDEO_ID);
    expect(videoRef?.node_id).toBe("v1");
  });

  it("extracts document refs from body", () => {
    const body = {
      schema_version: SCHEMA_VERSION,
      type: "doc",
      content: [{ type: "document_spot", attrs: { node_id: "d1", document_id: DOCUMENT_ID } }],
    };
    const refs = buildArticleRefs(body, null);
    const docRef = refs.find(r => r.ref_type === "document");
    expect(docRef).toBeDefined();
    expect(docRef?.ref_id).toBe(DOCUMENT_ID);
  });

  it("EC9: extracts course refs from body (AC4 fix — course is 4th kind)", () => {
    const body = {
      schema_version: SCHEMA_VERSION,
      type: "doc",
      content: [{ type: "course_spot", attrs: { node_id: "c1", course_id: COURSE_ID } }],
    };
    const refs = buildArticleRefs(body, null);
    const courseRef = refs.find(r => r.ref_type === "course");
    expect(courseRef).toBeDefined();
    expect(courseRef?.ref_id).toBe(COURSE_ID);
  });

  it("extracts inline image (media) refs from body", () => {
    const body = {
      schema_version: SCHEMA_VERSION,
      type: "doc",
      content: [{ type: "image", attrs: { node_id: "m1", key: `media/${MEDIA_ID}/480.webp`, alt: "photo" } }],
    };
    const refs = buildArticleRefs(body, null);
    const mediaRef = refs.find(r => r.ref_type === "media" && r.node_id === "m1");
    expect(mediaRef).toBeDefined();
  });

  it("includes cover image as media ref with node_id 'cover'", () => {
    const body = { schema_version: SCHEMA_VERSION, type: "doc", content: [] };
    const refs = buildArticleRefs(body, "img/cover.webp");
    const coverRef = refs.find(r => r.node_id === "cover" && r.ref_type === "media");
    expect(coverRef).toBeDefined();
  });

  it("EC9: add then remove a document card — refs follow exactly", () => {
    const bodyWithDoc = {
      schema_version: SCHEMA_VERSION,
      type: "doc",
      content: [{ type: "document_spot", attrs: { node_id: "d1", document_id: DOCUMENT_ID } }],
    };
    const bodyWithoutDoc = { schema_version: SCHEMA_VERSION, type: "doc", content: [] };

    const refsWithDoc = buildArticleRefs(bodyWithDoc, null);
    expect(refsWithDoc.some(r => r.ref_type === "document")).toBe(true);

    const refsWithout = buildArticleRefs(bodyWithoutDoc, null);
    expect(refsWithout.some(r => r.ref_type === "document")).toBe(false);
  });

  it("two cards with the same target but different node_id produce two refs", () => {
    const body = {
      schema_version: SCHEMA_VERSION,
      type: "doc",
      content: [
        { type: "document_spot", attrs: { node_id: "d1", document_id: DOCUMENT_ID } },
        { type: "document_spot", attrs: { node_id: "d2", document_id: DOCUMENT_ID } },
      ],
    };
    const refs = buildArticleRefs(body, null);
    const docRefs = refs.filter(r => r.ref_type === "document");
    expect(docRefs).toHaveLength(2);
    expect(docRefs.map(r => r.node_id)).toEqual(["d1", "d2"]);
  });
});
