// S-099: Audit unit tests — AC6, bank number masking
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({
  writeAuditRow: vi.fn().mockResolvedValue(undefined),
}));

import { writeAuditRow } from "@/lib/audit";
import { writeSettingsAuditRow } from "@/lib/settings/audit";

const ACTOR_ID = "user-admin-0001";

describe("writeSettingsAuditRow", () => {
  beforeEach(() => {
    vi.mocked(writeAuditRow).mockClear();
  });

  it("AC6: site group writes settings.change action", async () => {
    await writeSettingsAuditRow("site", { footer_business_name: "Old" }, { footer_business_name: "New" }, ACTOR_ID);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.change" })
    );
  });

  it("AC6: contact group writes settings.contact_change action", async () => {
    await writeSettingsAuditRow("contact", { contact_email: "old@x.lk" }, { contact_email: "new@x.lk" }, ACTOR_ID);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.contact_change" })
    );
  });

  it("AC6: business group writes settings.business_change action", async () => {
    await writeSettingsAuditRow("business", {}, { business_legal_name: "CeylonSafety" }, ACTOR_ID);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.business_change" })
    );
  });

  it("AC6: analytics group writes settings.change action", async () => {
    await writeSettingsAuditRow("analytics", {}, { analytics_measurement_id: "G-XYZ" }, ACTOR_ID);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ action: "settings.change" })
    );
  });

  it("AC6: bank numbers (8+ digits) are masked in audit values", async () => {
    await writeSettingsAuditRow(
      "business",
      { bank_account_details: "00012345678901" },
      { bank_account_details: "00099999999999" },
      ACTOR_ID
    );
    const call = vi.mocked(writeAuditRow).mock.calls[0][0];
    const before = call.before as Record<string, unknown>;
    const after = call.after as Record<string, unknown>;
    expect(before.bank_account_details).toBe("***");
    expect(after.bank_account_details).toBe("***");
  });

  it("AC6: actor_id is included in audit row", async () => {
    await writeSettingsAuditRow("contact", {}, {}, ACTOR_ID);
    expect(writeAuditRow).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: ACTOR_ID })
    );
  });
});
