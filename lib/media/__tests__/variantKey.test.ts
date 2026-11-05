import { describe, it, expect } from "vitest";
import { variantKey } from "@/lib/media/variantKey";

describe("variantKey", () => {
  it("appends _Nw to the base key (AC8)", () => {
    expect(variantKey("images/abc", 480)).toBe("images/abc_480w");
    expect(variantKey("images/abc", 1200)).toBe("images/abc_1200w");
  });

  it("works with nested paths", () => {
    expect(variantKey("images/article/uuid/file", 480))
      .toBe("images/article/uuid/file_480w");
  });
});
