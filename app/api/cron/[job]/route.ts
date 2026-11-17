import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { JOB_REGISTRY, timingSafeStringEqual, pingHeartbeat } from "@/lib/jobs";
import { safeErrorMessage } from "@/lib/errors";

export async function GET() {
  return new NextResponse(null, { status: 405 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ job: string }> }
) {
  // AC1: constant-time compare; do not trim the header value (EC2)
  const incoming = req.headers.get("x-cron-secret") ?? "";
  if (!timingSafeStringEqual(incoming, serverConfig.cronSecret)) {
    return new NextResponse(null, { status: 401 });
  }

  const { job } = await params;
  const handler = JOB_REGISTRY[job];

  // AC2: unknown job → 404 (after auth)
  if (!handler) {
    return new NextResponse(null, { status: 404 });
  }

  const start = Date.now();
  try {
    const result = await handler();
    const durationMs = Date.now() - start;
    if (!result.ok) {
      // Job completed without throwing but reported failure (e.g. DB error in replay).
      console.error(`[cron] job=${job} status=error duration=${durationMs}ms`);
      await pingHeartbeat(job, "fail");
      return new NextResponse(null, { status: 500 });
    }
    console.log(`[cron] job=${job} status=ok duration=${durationMs}ms`);
    await pingHeartbeat(job, "success");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const durationMs = Date.now() - start;
    // AC2: log through safeErrorMessage — no payload, no secrets
    console.error(`[cron] job=${job} status=error duration=${durationMs}ms message=${safeErrorMessage(err)}`);
    await pingHeartbeat(job, "fail");
    return new NextResponse(null, { status: 500 });
  }
}
