import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import Footer from "../Footer";

afterEach(() => { vi.clearAllMocks(); });

describe("AC6: Cookie settings link", () => {
  it("renders a Cookie settings button", () => {
    render(<Footer />);
    expect(screen.getByRole("button", { name: /cookie settings/i })).toBeInTheDocument();
  });

  it("dispatches open-cookie-banner event when clicked", async () => {
    render(<Footer />);
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("open-cookie-banner", handler);
    await userEvent.setup().click(screen.getByRole("button", { name: /cookie settings/i }));
    expect(events).toHaveLength(1);
    window.removeEventListener("open-cookie-banner", handler);
  });

  it("includes the trigger element in the event detail", async () => {
    render(<Footer />);
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("open-cookie-banner", handler);
    await userEvent.setup().click(screen.getByRole("button", { name: /cookie settings/i }));
    expect(events[0].detail?.trigger).toBeInstanceOf(HTMLElement);
    window.removeEventListener("open-cookie-banner", handler);
  });
});
