// S-092: TermsCheckbox — AC5
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

vi.mock("@/messages/en", () => ({
  t: (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import TermsCheckbox from "@/components/checkout/TermsCheckbox";

describe("TermsCheckbox", () => {
  it("renders an unchecked checkbox", () => {
    render(React.createElement(TermsCheckbox, { checked: false, onChange: vi.fn() }));
    const cb = screen.getByRole("checkbox");
    expect(cb).not.toBeChecked();
  });

  it("renders a checked checkbox", () => {
    render(React.createElement(TermsCheckbox, { checked: true, onChange: vi.fn() }));
    const cb = screen.getByRole("checkbox");
    expect(cb).toBeChecked();
  });

  it("calls onChange when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(React.createElement(TermsCheckbox, { checked: false, onChange }));
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalled();
  });

  it("renders terms and refund-policy links", () => {
    render(React.createElement(TermsCheckbox, { checked: false, onChange: vi.fn() }));
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it("links open in a new tab", () => {
    render(React.createElement(TermsCheckbox, { checked: false, onChange: vi.fn() }));
    const links = screen.getAllByRole("link");
    links.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
    });
  });
});
