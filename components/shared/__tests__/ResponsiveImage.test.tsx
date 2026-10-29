import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import * as React from "react";
import { ResponsiveImage } from "../ResponsiveImage";

describe("ResponsiveImage", () => {
  it("AC6: renders img with srcset when both variants provided", () => {
    render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        src1200="https://cdn.example.com/img-1200.webp"
        width={1200}
        height={800}
        alt="Test image"
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("srcset");
    expect(img.getAttribute("srcset")).toContain("480w");
    expect(img.getAttribute("srcset")).toContain("1200w");
  });

  it("AC6: always sets width and height attributes", () => {
    render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        src1200="https://cdn.example.com/img-1200.webp"
        width={600}
        height={400}
        alt="Test"
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "600");
    expect(img).toHaveAttribute("height", "400");
  });

  it("AC6: lazy loads by default", () => {
    render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        src1200="https://cdn.example.com/img-1200.webp"
        width={600}
        height={400}
        alt="Test"
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });

  it("AC6: eager loading when marked as first visible image", () => {
    render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        src1200="https://cdn.example.com/img-1200.webp"
        width={600}
        height={400}
        alt="Test"
        eager
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });

  it("AC7: renders plain src with no srcset when only one variant provided", () => {
    render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        width={400}
        height={300}
        alt="Narrow image"
      />
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/img-480.webp");
    expect(img).not.toHaveAttribute("srcset");
  });

  it("AC8: alt text is set on the img element", () => {
    render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        src1200="https://cdn.example.com/img-1200.webp"
        width={600}
        height={400}
        alt="A descriptive alt text"
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("alt", "A descriptive alt text");
  });

  it("AC8: decorative image has empty alt", () => {
    const { container } = render(
      <ResponsiveImage
        src480="https://cdn.example.com/img-480.webp"
        src1200="https://cdn.example.com/img-1200.webp"
        width={600}
        height={400}
        decorative
      />
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });

  it("EC3: renders spacer span when no variant URLs provided", () => {
    const { container } = render(
      <ResponsiveImage
        width={300}
        height={200}
        alt="Pending image"
      />
    );
    expect(container.querySelector("img")).toBeNull();
    const spacer = container.querySelector("span");
    expect(spacer).not.toBeNull();
    expect(spacer).toHaveStyle({ display: "inline-block", width: "300px", height: "200px" });
  });

  it("EC3: spacer is rendered when src480 is empty string", () => {
    const { container } = render(
      <ResponsiveImage
        src480=""
        width={300}
        height={200}
        alt="Pending"
      />
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
