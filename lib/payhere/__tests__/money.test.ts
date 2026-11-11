import { describe, it, expect } from "vitest";
import { centsToDecimal, parseCentsStrict } from "../money";

describe("centsToDecimal", () => {
  it("converts round amounts", () => {
    expect(centsToDecimal(715545)).toBe("7155.45");
  });

  it("pads single pence digit", () => {
    expect(centsToDecimal(715540)).toBe("7155.40");
  });

  it("handles zero", () => {
    expect(centsToDecimal(0)).toBe("0.00");
  });

  it("handles pence-only", () => {
    expect(centsToDecimal(5)).toBe("0.05");
  });

  it("handles large amounts", () => {
    expect(centsToDecimal(100000000)).toBe("1000000.00");
  });
});

describe("parseCentsStrict", () => {
  it("parses two decimal places", () => {
    expect(parseCentsStrict("7155.45")).toBe(715545);
  });

  it("parses one decimal place", () => {
    expect(parseCentsStrict("7155.4")).toBe(715540);
  });

  it("rejects three decimal places (EC1)", () => {
    expect(() => parseCentsStrict("7155.456")).toThrow();
  });

  it("rejects integer with no decimal (EC2)", () => {
    expect(() => parseCentsStrict("7155")).toThrow();
  });

  it("rejects non-numeric string", () => {
    expect(() => parseCentsStrict("abc")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => parseCentsStrict("")).toThrow();
  });

  it("rejects negative string", () => {
    expect(() => parseCentsStrict("-7.00")).toThrow();
  });

  it("round-trips with centsToDecimal", () => {
    expect(parseCentsStrict(centsToDecimal(715545))).toBe(715545);
  });
});
