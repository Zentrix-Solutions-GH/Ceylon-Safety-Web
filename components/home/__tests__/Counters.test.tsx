import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Counters } from "@/components/home/Counters";
import type { Counters as CountersData } from "@/types/api";

const base: CountersData = {
  articles: null,
  documents: null,
  users: null,
  downloads: null,
};

describe("Counters", () => {
  it("hides null counter", () => {
    const { container } = render(<Counters data={{ ...base, articles: null }} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides value 9", () => {
    const { container } = render(<Counters data={{ ...base, articles: 9 }} />);
    expect(container.firstChild).toBeNull();
  });

  it("formats 10 as 10+", () => {
    render(<Counters data={{ ...base, articles: 10 }} />);
    expect(screen.getByText("10+")).toBeInTheDocument();
  });

  it("formats 50 as 50+ (backend rounds 55 → 50 before component receives it)", () => {
    render(<Counters data={{ ...base, articles: 50 }} />);
    expect(screen.getByText("50+")).toBeInTheDocument();
  });

  it("formats 1000 as 1,000+ (backend rounds 1234 → 1000 before component receives it)", () => {
    render(<Counters data={{ ...base, articles: 1000 }} />);
    expect(screen.getByText("1,000+")).toBeInTheDocument();
  });

  it("renders all four visible counters", () => {
    render(
      <Counters data={{ articles: 100, documents: 200, users: 300, downloads: 400 }} />
    );
    expect(screen.getByText("100+")).toBeInTheDocument();
    expect(screen.getByText("200+")).toBeInTheDocument();
    expect(screen.getByText("300+")).toBeInTheDocument();
    expect(screen.getByText("400+")).toBeInTheDocument();
  });

  it("hides section when all counters are null or below threshold", () => {
    const { container } = render(
      <Counters data={{ articles: null, documents: 5, users: null, downloads: null }} />
    );
    expect(container.firstChild).toBeNull();
  });
});
