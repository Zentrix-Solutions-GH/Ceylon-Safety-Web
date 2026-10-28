import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SubmitButton } from "../SubmitButton";
import * as React from "react";

describe("SubmitButton", () => {
  it("AC3: disabled and shows pending label when isPending", () => {
    render(<SubmitButton isPending pendingLabel="Saving...">Submit</SubmitButton>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("AC3: shows children label and is enabled when not pending", () => {
    render(<SubmitButton>Submit</SubmitButton>);
    const btn = screen.getByRole("button");
    expect(screen.getByText("Submit")).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("AC3: uses default pending label when not provided", () => {
    render(<SubmitButton isPending>Submit</SubmitButton>);
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("EC1: disabled button cannot be clicked (double-submit guard)", async () => {
    const handleSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit}>
        <SubmitButton isPending>Submit</SubmitButton>
      </form>
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    // A disabled button does not fire click events
    await userEvent.setup().click(btn);
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
