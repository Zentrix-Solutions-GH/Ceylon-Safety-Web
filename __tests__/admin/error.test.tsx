// S-045: Admin error page — AC5

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import AdminError from "@/app/admin/error";

describe("AC5: admin error page", () => {
  it("renders a 'Something went wrong' heading", () => {
    const reset = vi.fn();
    render(<AdminError error={new Error("boom")} reset={reset} />);
    expect(
      screen.getByRole("heading", { name: /something went wrong/i })
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    const reset = vi.fn();
    render(<AdminError error={new Error("boom")} reset={reset} />);
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("retry button calls reset()", () => {
    const reset = vi.fn();
    render(<AdminError error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("does NOT expose the error message or stack trace", () => {
    const reset = vi.fn();
    const err = new Error("secret internal error detail");
    render(<AdminError error={err} reset={reset} />);
    expect(screen.queryByText(/secret internal error detail/i)).not.toBeInTheDocument();
  });
});
