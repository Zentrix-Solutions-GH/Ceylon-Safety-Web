import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useRouter } from "next/navigation";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

import SearchBar from "@/components/search/SearchBar";

function setup(scope: "home" | "articles" | "documents" = "home") {
  const push = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  render(<SearchBar scope={scope} />);
  return { push };
}

describe("SearchBar", () => {
  it("AC1: home scope navigates to /search?scope=home&q=<text>", async () => {
    const user = userEvent.setup();
    const { push } = setup("home");
    await user.type(screen.getByRole("searchbox"), "fire safety");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(push).toHaveBeenCalledWith("/search?scope=home&q=fire+safety");
  });

  it("AC1: articles scope navigates with scope=articles", async () => {
    const user = userEvent.setup();
    const { push } = setup("articles");
    await user.type(screen.getByRole("searchbox"), "ladder");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(push).toHaveBeenCalledWith("/search?scope=articles&q=ladder");
  });

  it("AC1: documents scope navigates with scope=documents", async () => {
    const user = userEvent.setup();
    const { push } = setup("documents");
    await user.type(screen.getByRole("searchbox"), "checklist");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(push).toHaveBeenCalledWith("/search?scope=documents&q=checklist");
  });

  it("AC3: empty query makes no navigation", async () => {
    const user = userEvent.setup();
    const { push } = setup("home");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(push).not.toHaveBeenCalled();
  });

  it("AC3: whitespace-only query makes no navigation", async () => {
    const user = userEvent.setup();
    const { push } = setup("home");
    await user.type(screen.getByRole("searchbox"), "   ");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(push).not.toHaveBeenCalled();
  });

  it("AC3: input enforces 100 character maxlength", () => {
    setup("home");
    expect(screen.getByRole("searchbox")).toHaveAttribute("maxlength", "100");
  });

  it("AC8: search input has accessible label", () => {
    setup("home");
    const input = screen.getByRole("searchbox");
    expect(input).toHaveAccessibleName();
  });

  it("EC1: leading/trailing spaces are trimmed in the query", async () => {
    const user = userEvent.setup();
    const { push } = setup("home");
    await user.type(screen.getByRole("searchbox"), "  fire  ");
    await user.click(screen.getByRole("button", { name: /search/i }));
    expect(push).toHaveBeenCalledWith("/search?scope=home&q=fire");
  });
});
