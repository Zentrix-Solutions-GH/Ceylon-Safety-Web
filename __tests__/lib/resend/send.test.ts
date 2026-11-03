// S-040: sendEmail helper — AC1, AC4, AC5, EC1, EC2, EC3

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    supabaseServiceRoleKey: "service-role-key",
    resendApiKey: "re_test_key",
    emailFrom: "noreply@ceylonsafety.com",
  },
  publicConfig: {
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "anon-key",
    appUrl: "https://ceylonsafety.com",
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("resend", () => ({
  Resend: vi.fn(),
}));

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { sendEmail } from "@/lib/resend/client";

function makeSupabaseMock(
  insertError: unknown = null,
  insertData: unknown = { id: 1 }
) {
  // insert().select("id").single() chain
  const single = vi.fn().mockResolvedValue({ data: insertData, error: insertError });
  const selectInsert = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select: selectInsert });
  // update().eq("id", ...) chain
  const eqUpdate = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: eqUpdate });
  const from = vi.fn().mockReturnValue({ insert, update });
  return { from, insert, selectInsert, single, update, eqUpdate };
}

function makeResendMock(sendError: Error | null = null) {
  const send = sendError
    ? vi.fn().mockRejectedValue(sendError)
    : vi.fn().mockResolvedValue({ data: { id: "msg_123" }, error: null });
  return { emails: { send } };
}

const SEND_OPTS = {
  to: "user@example.com",
  template: "welcome",
  relatedType: "user",
  relatedId: "u-uuid",
  subject: "Welcome",
  html: "<p>Welcome</p>",
};

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC1: inserts log row first; sends if insert succeeded
  it("AC1: inserts email_logs row before sending", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    const resendMock = makeResendMock();
    vi.mocked(Resend).mockReturnValue(resendMock as never);

    await sendEmail(SEND_OPTS);

    expect(sb.from).toHaveBeenCalledWith("email_logs");
    expect(sb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        to_email: "user@example.com",
        template: "welcome",
        related_type: "user",
        related_id: "u-uuid",
        status: "queued",
      })
    );
    expect(resendMock.emails.send).toHaveBeenCalledOnce();
  });

  // AC1: unique index conflict → no send, no throw
  it("AC1: unique index violation sends nothing and does not throw", async () => {
    const uniqueError = { code: "23505", message: "duplicate key value" };
    const sb = makeSupabaseMock(uniqueError, null);
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    const resendMock = makeResendMock();
    vi.mocked(Resend).mockReturnValue(resendMock as never);

    await expect(sendEmail(SEND_OPTS)).resolves.not.toThrow();
    expect(resendMock.emails.send).not.toHaveBeenCalled();
  });

  // AC4 / EC1: Resend unreachable — failure logged by row id, sign-in not broken
  it("EC1: Resend unreachable — updates log row by id with failure, does not throw", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    vi.mocked(Resend).mockReturnValue(makeResendMock(new Error("Network error")) as never);

    await expect(sendEmail(SEND_OPTS)).resolves.not.toThrow();

    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
    expect(sb.eqUpdate).toHaveBeenCalledWith("id", 1);

    // error field must not contain a stack trace or raw message content
    const updateArg = sb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof updateArg.error).toBe("string");
    expect(updateArg.error).not.toContain("at ");
    expect(updateArg.error).not.toContain("@");
  });

  // AC4: success path updates status to 'sent' and stores provider_message_id by row id
  it("AC4: success updates log status to sent with provider_message_id by row id", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    vi.mocked(Resend).mockReturnValue(makeResendMock() as never);

    await sendEmail(SEND_OPTS);

    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", provider_message_id: "msg_123" })
    );
    expect(sb.eqUpdate).toHaveBeenCalledWith("id", 1);
  });

  // AC5: no tokens, passwords or PII in the log row
  it("AC5: insert row contains no token, password or secret fields", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    vi.mocked(Resend).mockReturnValue(makeResendMock() as never);

    await sendEmail(SEND_OPTS);

    const insertArg = sb.insert.mock.calls[0][0] as Record<string, unknown>;
    const keys = Object.keys(insertArg);
    const forbidden = ["password", "token", "secret", "code", "key"];
    for (const f of forbidden) {
      expect(keys.some((k) => k.toLowerCase().includes(f))).toBe(false);
    }
    expect(insertArg).not.toHaveProperty("html");
    expect(insertArg).not.toHaveProperty("body");
  });

  // EC2: bounced / sync rejection — logged as failed, not thrown
  it("EC2: Resend sync rejection (throw) is logged as failed, not thrown", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    vi.mocked(Resend).mockReturnValue(makeResendMock(new Error("validation_error")) as never);

    await expect(sendEmail(SEND_OPTS)).resolves.not.toThrow();
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" })
    );
  });

  // EC2: Resend returns error object (non-throw) — logged as failed, not thrown
  it("EC2: Resend error-object response (non-throw) is logged as failed, not thrown", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    const errorObjectResend = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { name: "validation_error", message: "Invalid address" },
        }),
      },
    };
    vi.mocked(Resend).mockReturnValue(errorObjectResend as never);

    await expect(sendEmail(SEND_OPTS)).resolves.not.toThrow();
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "validation_error" })
    );
  });

  // Guard: relatedType without relatedId throws instead of silently bypassing the unique index
  it("throws if relatedType is set but relatedId is omitted", async () => {
    await expect(
      sendEmail({ ...SEND_OPTS, relatedType: "user", relatedId: undefined })
    ).rejects.toThrow(/relatedId is required when relatedType is set/);
  });

  // AC3: cross-path deduplication — simulates verifyEmail + Google callback for same user
  it("AC3: second sendEmail call for same (template, relatedType, relatedId) does not reach Resend", async () => {
    // First call: insert succeeds → Resend called once
    const sb1 = makeSupabaseMock();
    const sb2 = makeSupabaseMock({ code: "23505", message: "duplicate key" }, null);
    let callCount = 0;
    vi.mocked(createSupabaseServiceRoleClient)
      .mockImplementationOnce(() => { callCount++; return sb1 as never; })
      .mockImplementationOnce(() => { callCount++; return sb2 as never; });
    const resendMock = makeResendMock();
    vi.mocked(Resend).mockReturnValue(resendMock as never);

    await sendEmail(SEND_OPTS);          // email verify path
    await sendEmail(SEND_OPTS);          // Google callback path (same user)

    expect(resendMock.emails.send).toHaveBeenCalledTimes(1); // unique index blocked the second
    expect(callCount).toBe(2);           // both call sites ran
  });

  // EC3: daily cap / rate-limit error — fails cleanly and is logged
  it("EC3: rate-limit error from Resend is logged as failed, does not throw", async () => {
    const sb = makeSupabaseMock();
    vi.mocked(createSupabaseServiceRoleClient).mockReturnValue(sb as never);
    // Resend returns an error object (not a thrown exception) for rate limits
    const rateLimitResend = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { name: "rate_limit_exceeded", message: "Daily sending quota exceeded" },
        }),
      },
    };
    vi.mocked(Resend).mockReturnValue(rateLimitResend as never);

    await expect(sendEmail(SEND_OPTS)).resolves.not.toThrow();
    expect(sb.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", error: "rate_limit_exceeded" })
    );
  });
});
