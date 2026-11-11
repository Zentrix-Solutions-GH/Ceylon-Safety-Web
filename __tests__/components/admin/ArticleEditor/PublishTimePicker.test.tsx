// S-057: PublishTimePicker — AC6

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PublishTimePicker from "@/components/admin/ArticleEditor/PublishTimePicker";

afterEach(() => {
  vi.useRealTimers();
});

describe("AC6 — almost immediate warning", () => {
  it("shows almost-immediate warning for a time less than 1 minute away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T10:00:00Z"));
    // 30 seconds in the future
    const soon = new Date(Date.now() + 30_000).toISOString();
    render(<PublishTimePicker value={soon} onChange={() => {}} />);
    expect(screen.getByText(/almost immediately/i)).toBeInTheDocument();
  });

  it("shows Will go live date for a time more than 1 minute away", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T10:00:00Z"));
    // 2 minutes in the future
    const future = new Date(Date.now() + 120_000).toISOString();
    render(<PublishTimePicker value={future} onChange={() => {}} />);
    expect(screen.getByText(/will go live/i)).toBeInTheDocument();
    expect(screen.queryByText(/almost immediately/i)).toBeNull();
  });
});

describe("AC6 — timezone label", () => {
  it("shows Sri Lanka timezone label", () => {
    render(<PublishTimePicker value={null} onChange={() => {}} />);
    expect(screen.getByText(/Asia\/Colombo/i)).toBeInTheDocument();
  });
});
