import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormField } from "../FormField";
import { Input } from "@/components/ui/input";
import * as React from "react";

describe("FormField", () => {
  it("AC2: label linked to input with htmlFor/id", () => {
    render(
      <FormField id="email" label="Email">
        <Input name="email" />
      </FormField>
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("AC2: hint text linked via aria-describedby", () => {
    render(
      <FormField id="email" label="Email" hint="We never share your email">
        <Input name="email" />
      </FormField>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-describedby", expect.stringContaining("email-hint"));
    expect(screen.getByText("We never share your email")).toBeInTheDocument();
  });

  it("AC2: error text linked via aria-describedby and sets aria-invalid", () => {
    render(
      <FormField id="email" label="Email" error="Invalid email address">
        <Input name="email" />
      </FormField>
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", expect.stringContaining("email-error"));
    expect(screen.getByText("Invalid email address")).toBeInTheDocument();
  });

  it("AC2: required shown in words, not colour only", () => {
    render(
      <FormField id="email" label="Email" required>
        <Input name="email" />
      </FormField>
    );
    expect(screen.getByText("(required)")).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("hint and error both appear in aria-describedby", () => {
    render(
      <FormField id="pw" label="Password" hint="At least 8 characters" error="Too short">
        <Input name="pw" type="password" />
      </FormField>
    );
    const input = document.getElementById("pw")!;
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("pw-hint");
    expect(describedBy).toContain("pw-error");
  });
});
