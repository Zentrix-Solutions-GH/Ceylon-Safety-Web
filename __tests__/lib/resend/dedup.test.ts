// S-088: AC8, EC2 — duplicate send blocked by email_logs

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  serverConfig: {
    resendApiKey: "re_test",
    emailFrom: "Ceylon Safety <no-reply@ceylonsafety.lk>",
  },
}));

const PG_UNIQUE = "23505";

let insertMock: ReturnType<typeof vi.fn>;
let updateEqMock: ReturnType<typeof vi.fn>;
let updateMock: ReturnType<typeof vi.fn>;
let maybeSingleMock: ReturnType<typeof vi.fn>;
let sendMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: vi.fn().mockImplementation(() => ({
      insert: insertMock,
      update: updateMock,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }),
        }),
      }),
    })),
  }),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendEmail } from "@/lib/resend/client";

beforeEach(() => {
  vi.clearAllMocks();
  updateEqMock = vi.fn().mockResolvedValue({ error: null });
  updateMock = vi.fn().mockReturnValue({ eq: updateEqMock });
  maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
  insertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    }),
  });
  sendMock = vi.fn().mockResolvedValue({ data: { id: "msg_ok" }, error: null });
});

describe("sendEmail dedup via unique constraint (AC8, EC2)", () => {
  it("skips send when unique constraint fires on insert", async () => {
    insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: PG_UNIQUE, message: "duplicate key" },
        }),
      }),
    });

    await sendEmail({
      to: "buyer@example.com",
      template: "bank_approved",
      relatedType: "order",
      relatedId: "ord-dup-1",
      subject: "Approved",
      html: "<p>approved</p>",
      text: "approved",
    });

    // No Resend call, no update call — email was already logged
    expect(sendMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sends normally on first call when no duplicate exists", async () => {
    await sendEmail({
      to: "buyer@example.com",
      template: "bank_approved",
      relatedType: "order",
      relatedId: "ord-first-1",
      subject: "Approved",
      html: "<p>approved</p>",
      text: "approved",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });
});
