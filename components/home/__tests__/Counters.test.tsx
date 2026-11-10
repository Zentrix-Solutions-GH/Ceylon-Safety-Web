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

  it("formats 55 as 50+", () => {
    render(<Counters data={{ ...base, articles: 55 }} />);
    expect(screen.getByText("50+")).toBeInTheDocument();
  });

  it("formats 1234 as 1,000+", () => {
    render(<Counters data={{ ...base, articles: 1234 }} />);
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
