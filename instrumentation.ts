export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate all required server env vars at startup; throws with clear message on failure
    const { payhereConfig } = await import("./lib/config");
    payhereConfig();
  }
}
