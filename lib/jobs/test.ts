// AC5: no-op test job — exists so the scheduler can be verified.
// Running twice has no side effects (idempotent per AC3).
export async function testJob(): Promise<{ ok: boolean }> {
  return { ok: true };
}
