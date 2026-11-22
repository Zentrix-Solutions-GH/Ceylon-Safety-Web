// S-086: AC9 — email logs must not contain personal data

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    resendApiKey: "re_test",
    emailFrom: "Ceylon Safety <no-reply@ceylonsafety.lk>",
  },
}));

// Capture the DB update calls so we can inspect what error string was stored.
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const selectSingleMock = vi.fn().mockResolvedValue({
  data: { id: 1 },
  error: null,
});
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: selectSingleMock,
        }),
      }),
      update: updateMock,
    }),
  }),
}));

// Resend SDK throws an error whose message contains the recipient address.
// sendEmail must NOT write that message into email_logs.error.
class NetworkError extends Error {
  constructor() {
    super("Could not connect — recipient: buyer@example.com leaked in transport");
    this.name = "NetworkError";
  }
}

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockRejectedValue(new NetworkError()),
    },
  })),
}));

import { sendEmail } from "@/lib/resend/client";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-arm mocks cleared above
  updateEqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: updateEqMock });
  selectSingleMock.mockResolvedValue({ data: { id: 1 }, error: null });
});

describe("email log error sanitisation (AC9)", () => {
  it("stores named error class, not the error message, in email_logs (AC9)", async () => {
    // The Resend mock throws NetworkError whose message contains the recipient.
    // sendEmail must store only the class name ("NetworkError") in the DB row.
    await sendEmail({
      to: "buyer@example.com",
      template: "receipt",
      relatedType: "order",
      relatedId: "ord-ac9-named",
      subject: "Your receipt",
      html: "<p>receipt</p>",
      text: "receipt",
    });

    const updateArg = vi.mocked(updateMock).mock.calls[0]?.[0] as { error?: string };
    const storedError = updateArg?.error ?? "";
    expect(storedError).toBe("NetworkError");
    expect(storedError).not.toContain("@");
    expect(storedError).not.toContain("buyer");
  });

  it("falls back to 'network_error' when a plain Error is thrown (AC9)", async () => {
    // Re-arm the Resend mock to throw a plain Error (constructor.name === "Error").
    const { Resend } = await import("resend");
    vi.mocked(Resend).mockImplementationOnce(
      () =>
        ({
          emails: { send: vi.fn().mockRejectedValue(new Error("connection refused at 192.168.1.1")) },
        }) as never,
    );

    await sendEmail({
      to: "buyer2@example.com",
      template: "receipt",
      relatedType: "order",
      relatedId: "ord-ac9-plain",
      subject: "Your receipt",
      html: "<p>receipt</p>",
      text: "receipt",
    });

    const updateArg = vi.mocked(updateMock).mock.calls[0]?.[0] as { error?: string };
    const storedError = updateArg?.error ?? "";
    expect(storedError).toBe("network_error");
    expect(storedError).not.toContain("192");
  });

  it("stores only the error class name in email_logs, never the error message or recipient address (AC9)", async () => {
    // sendEmail throws from Resend with a message that contains the recipient email.
    // The DB update's error field must contain only the class name ("NetworkError"),
    // not the message text ("buyer@example.com ...").
    await sendEmail({
      to: "buyer@example.com",
      template: "receipt",
      relatedType: "order",
      relatedId: "ord-ac9-test",
      subject: "Your receipt",
      html: "<p>receipt</p>",
      text: "receipt",
    });

    // The update call that sets status=failed must have been called
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );

    // Extract the error string that was written
    const updateArg = vi.mocked(updateMock).mock.calls[0]?.[0] as { error?: string };
    const storedError = updateArg?.error ?? "";

    expect(storedError).toBe("NetworkError");
    expect(storedError).not.toContain("@");
    expect(storedError).not.toContain("buyer");
    expect(storedError).not.toContain("example.com");
  });
});
