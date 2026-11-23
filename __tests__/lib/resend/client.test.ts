// S-088: AC7, AC9 — Resend retry + PII-free error logging

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    resendApiKey: "re_test",
    emailFrom: "Ceylon Safety <no-reply@ceylonsafety.lk>",
  },
}));

// Supabase mock shared across tests
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
const selectSingleMock = vi.fn().mockResolvedValue({ data: { id: 42 }, error: null });
const fromMock = vi.fn().mockReturnValue({
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: selectSingleMock }),
  }),
  update: updateMock,
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ from: fromMock }),
}));

let sendMock: ReturnType<typeof vi.fn>;
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendEmail } from "@/lib/resend/client";

const EMAIL_OPTS = {
  to: "buyer@example.com",
  template: "receipt" as const,
  relatedType: "order",
  relatedId: "ord-retry-1",
  subject: "Test",
  html: "<p>hi</p>",
  text: "hi",
};

function make5xxError() {
  return { data: null, error: { name: "InternalServerError", statusCode: 500, message: "server error" } };
}

function makeRateLimitError() {
  return { data: null, error: { name: "RateLimitExceededError", statusCode: 429, message: "rate limited" } };
}

function makeSuccess() {
  return { data: { id: "msg_ok" }, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateEqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: updateEqMock });
  selectSingleMock.mockResolvedValue({ data: { id: 42 }, error: null });
  fromMock.mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: selectSingleMock }),
    }),
    update: updateMock,
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  });
  sendMock = vi.fn().mockResolvedValue(makeSuccess());
});

// ─── AC7: retry on 5xx ────────────────────────────────────────────────────────

describe("sendEmail retry on 5xx (AC7)", () => {
  it("retries up to 3 times on 5xx, succeeds on the 3rd attempt", async () => {
    sendMock = vi.fn()
      .mockResolvedValueOnce(make5xxError())
      .mockResolvedValueOnce(make5xxError())
      .mockResolvedValueOnce(makeSuccess());

    await sendEmail(EMAIL_OPTS);

    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("marks failed and does not retry a 4th time after 3 consecutive 5xx", async () => {
    sendMock = vi.fn().mockResolvedValue(make5xxError());

    await sendEmail(EMAIL_OPTS);

    expect(sendMock).toHaveBeenCalledTimes(3);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("retries on network throw, succeeds on 2nd attempt", async () => {
    class FetchError extends Error { constructor() { super("fetch failed"); this.name = "FetchError"; } }
    sendMock = vi.fn()
      .mockRejectedValueOnce(new FetchError())
      .mockResolvedValueOnce(makeSuccess());

    await sendEmail(EMAIL_OPTS);

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("retries on 429, succeeds on 2nd attempt", async () => {
    sendMock = vi.fn()
      .mockResolvedValueOnce(makeRateLimitError())
      .mockResolvedValueOnce(makeSuccess());

    await sendEmail(EMAIL_OPTS);

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("does NOT retry on 4xx (validation) errors", async () => {
    sendMock = vi.fn().mockResolvedValue({
      data: null,
      error: { name: "ValidationError", statusCode: 422, message: "invalid address" },
    });

    await sendEmail(EMAIL_OPTS);

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});

// ─── AC9: no PII in logs ──────────────────────────────────────────────────────

describe("sendEmail PII guard (AC9)", () => {
  it("stores only error class name, never email address, in email_logs", async () => {
    class NetworkError extends Error {
      constructor() {
        super("Could not connect to buyer@example.com");
        this.name = "NetworkError";
      }
    }
    sendMock = vi.fn().mockRejectedValue(new NetworkError());

    await sendEmail(EMAIL_OPTS);

    const updateArg = vi.mocked(updateMock).mock.calls[0]?.[0] as { error?: string };
    const stored = updateArg?.error ?? "";
    expect(stored).toBe("NetworkError");
    expect(stored).not.toContain("@");
    expect(stored).not.toContain("buyer");
  });
});

// ─── sendQueuedEmail ─────────────────────────────────────────────────────────

describe("sendQueuedEmail (AC3, AC4, EC2)", () => {
  it("fetches queued row, sends, and marks sent", async () => {
    const { sendQueuedEmail } = await import("@/lib/resend/client");

    // The from() mock for select needs to return a queued row
    fromMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: selectSingleMock }),
      }),
      update: updateMock,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 99, to_email: "buyer@example.com" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    await sendQueuedEmail({
      template: "download_request_approved" as const,
      relatedType: "download_request",
      relatedId: "req-uuid-1",
      renderEmail: () => ({
        subject: "Your request is approved",
        html: "<p>approved</p>",
        text: "approved",
      }),
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("does nothing if no queued row is found (already sent or deduped)", async () => {
    const { sendQueuedEmail } = await import("@/lib/resend/client");

    fromMock.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: selectSingleMock }),
      }),
      update: updateMock,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    await sendQueuedEmail({
      template: "download_request_approved" as const,
      relatedType: "download_request",
      relatedId: "req-not-found",
      renderEmail: () => ({ subject: "X", html: "<p>X</p>", text: "X" }),
    });

    expect(sendMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
