import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { HeroSearchForm } from "@/components/articles/HeroSearchForm";

afterEach(() => { vi.restoreAllMocks(); });

describe("HeroSearchForm", () => {
  it("AC5: form action is /search with GET method", () => {
    render(<HeroSearchForm />);
    const form = document.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/search");
    expect(form).toHaveAttribute("method", "get");
  });

  it("AC5: hidden scope input has name=scope and value=articles", () => {
    render(<HeroSearchForm />);
    const scopeInput = document.querySelector('input[name="scope"]') as HTMLInputElement;
    expect(scopeInput).not.toBeNull();
    expect(scopeInput.type).toBe("hidden");
    expect(scopeInput.value).toBe("articles");
  });

  it("AC5: search input has name=q", () => {
    render(<HeroSearchForm />);
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });

  it("AC5: submit button is present", () => {
    render(<HeroSearchForm />);
    expect(screen.getByRole("button", { name: /search/i })).toHaveAttribute("type", "submit");
  });

  it("AC5: submitting with empty query calls preventDefault", () => {
    render(<HeroSearchForm />);
    const spy = vi.spyOn(Event.prototype, "preventDefault");
    fireEvent.submit(document.querySelector("form")!);
    expect(spy).toHaveBeenCalled();
  });

  it("AC5: submitting with non-empty query does not call preventDefault", async () => {
    const user = userEvent.setup();
    render(<HeroSearchForm />);
    await user.type(screen.getByRole("searchbox"), "fire safety");
    const spy = vi.spyOn(Event.prototype, "preventDefault");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});
