export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate all required server env vars at startup; throws with clear message on failure
    await import("./lib/config");
  }
}
