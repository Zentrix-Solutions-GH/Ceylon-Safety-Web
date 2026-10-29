import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import * as React from "react";
import { Input } from "../input";

describe("Input (AC8)", () => {
  it("AC8: allows paste", async () => {
    render(<Input aria-label="text field" />);
    const input = screen.getByRole("textbox");
    await userEvent.setup().click(input);
    await userEvent.setup().paste("pasted content");
    expect((input as HTMLInputElement).value).toBe("pasted content");
  });

  it("AC8: forwards autoComplete prop", () => {
    render(<Input aria-label="email" autoComplete="email" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("autocomplete", "email");
  });

  it("AC8: forwards inputMode prop", () => {
    render(<Input aria-label="phone" inputMode="tel" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("inputmode", "tel");
  });

  it("AC8: has min-h-[44px] class for tap target", () => {
    render(<Input aria-label="test" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("min-h-[44px]");
  });
});
