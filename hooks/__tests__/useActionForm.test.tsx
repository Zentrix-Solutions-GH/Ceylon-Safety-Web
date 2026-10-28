import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import * as React from "react";
import { useActionForm } from "../useActionForm";
import type { ActionResult } from "@/types/api";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

const mapError = (code: string) =>
  ({ user_not_found: "User not found", unknown: "Something went wrong" }[code] ?? "Something went wrong");

function mockAction(result: ActionResult) {
  return vi.fn((_v: { email: string }) => Promise.resolve(result));
}

function TestForm({ action }: { action: (v: { email: string }) => Promise<ActionResult> }) {
  const { fieldErrors, formError, isPending, handleSubmit, handleBlur } = useActionForm({
    schema,
    action,
    mapError,
  });
  return (
    <form onSubmit={handleSubmit}>
      <input
        id="email"
        name="email"
        aria-label="Email"
        onBlur={handleBlur}
        aria-describedby={fieldErrors.email ? "email-error" : undefined}
        aria-invalid={fieldErrors.email ? true : undefined}
      />
      {fieldErrors.email && <p id="email-error" role="alert">{fieldErrors.email}</p>}
      {formError && <p role="alert">{formError}</p>}
      <button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Submit"}</button>
    </form>
  );
}

describe("useActionForm", () => {
  it("AC5: validates on submit, shows field error, action not called", async () => {
    const action = mockAction({ ok: true });
    render(<TestForm action={action} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("AC5: validates on blur", async () => {
    const action = mockAction({ ok: true });
    render(<TestForm action={action} />);
    const input = screen.getByLabelText("Email");
    await userEvent.setup().type(input, "notanemail");
    await userEvent.setup().tab();
    expect(await screen.findByText("Invalid email address")).toBeInTheDocument();
  });

  it("AC5: calls action with valid data", async () => {
    const action = mockAction({ ok: true });
    render(<TestForm action={action} />);
    await userEvent.setup().type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(action).toHaveBeenCalledWith({ email: "test@example.com" }));
  });

  it("AC5: field error from action shown under field", async () => {
    const action = mockAction({ ok: false, code: "user_not_found", field: "email" });
    render(<TestForm action={action} />);
    await userEvent.setup().type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("AC6: non-field error shown in summary", async () => {
    const action = mockAction({ ok: false, code: "user_not_found" });
    render(<TestForm action={action} />);
    await userEvent.setup().type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("User not found")).toBeInTheDocument();
  });

  it("EC1: second submit while in-flight is ignored", async () => {
    let resolveAction!: (r: ActionResult) => void;
    const action = vi.fn(
      (_v: { email: string }) => new Promise<ActionResult>((res) => { resolveAction = res; })
    );
    render(<TestForm action={action} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    // Button is now disabled/pending; clicking again does nothing
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    resolveAction({ ok: true });
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });

  it("EC2: action throws → shows unknown message, form stays filled", async () => {
    const action = vi.fn((_v: { email: string }) => Promise.reject(new Error("Network error")));
    render(<TestForm action={action} />);
    await userEvent.setup().type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("test@example.com");
  });

  it("EC4: unknown error code passed through mapError", async () => {
    const action = mockAction({ ok: false, code: "new_weird_code" });
    render(<TestForm action={action} />);
    await userEvent.setup().type(screen.getByLabelText("Email"), "test@example.com");
    await userEvent.setup().click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });
});
