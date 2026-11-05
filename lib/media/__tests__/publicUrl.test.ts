// S-047: publicUrl helper — AC10

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  r2Config: vi.fn(() => ({
    publicMediaBaseUrl: "https://img.example.com",
  })),
}));

import { publicUrl } from "@/lib/media/publicUrl";

describe("publicUrl", () => {
  it("AC10: returns PUBLIC_MEDIA_BASE_URL + key with no bucket address", () => {
    expect(publicUrl("images/foo/bar")).toBe("https://img.example.com/images/foo/bar");
  });

  it("AC10: works for a variant key", () => {
    expect(publicUrl("images/article/uuid/abc_480w")).toBe(
      "https://img.example.com/images/article/uuid/abc_480w"
    );
  });
});
