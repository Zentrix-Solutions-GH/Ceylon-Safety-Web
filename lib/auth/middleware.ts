// Backend owner: S-034
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function middleware(_req: NextRequest) { return NextResponse.next(); }