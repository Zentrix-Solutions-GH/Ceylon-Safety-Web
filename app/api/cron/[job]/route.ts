import { NextResponse } from "next/server";
import { serverConfig } from "@/lib/config";
import { JOB_REGISTRY, timingSafeStringEqual, pingHeartbeat } from "@/lib/jobs";

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
    await handler();
    const durationMs = Date.now() - start;
    console.log(`[cron] job=${job} status=ok duration=${durationMs}ms`);
    await pingHeartbeat(job, "success");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const durationMs = Date.now() - start;
    // AC2: log the error through a safe message — no payload, no secrets
    console.error(`[cron] job=${job} status=error duration=${durationMs}ms message=${err instanceof Error ? err.message : "unknown"}`);
    await pingHeartbeat(job, "fail");
    return new NextResponse(null, { status: 500 });
  }
}
