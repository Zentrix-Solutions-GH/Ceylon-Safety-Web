import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FormError } from "../FormError";
import * as React from "react";

describe("FormError", () => {
  it("AC4: renders nothing when no errors", () => {
    const { container } = render(<FormError errors={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("AC4: role=alert present when errors exist", () => {
    render(<FormError errors={{ email: "Invalid email" }} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("AC4: field errors rendered as links to their fields", () => {
    render(<FormError errors={{ email: "Invalid email", password: "Too short" }} />);
    expect(screen.getByRole("link", { name: "Invalid email" })).toHaveAttribute("href", "#email");
    expect(screen.getByRole("link", { name: "Too short" })).toHaveAttribute("href", "#password");
  });

  it("AC4: non-field error shown without a link", () => {
    render(<FormError errors={{}} nonFieldError="Something went wrong" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("EC3: unknown field still shows in summary", () => {
    render(<FormError errors={{ unknownField: "Some error" }} />);
    expect(screen.getByRole("link", { name: "Some error" })).toHaveAttribute("href", "#unknownField");
  });
});
