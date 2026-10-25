// Backend owner: S-034 (auth middleware), S-009 (rate limiting)
export { default } from "@/lib/auth/middleware";

export const config = {
  matcher: [
    "/admin/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/download/:path*",
    "/purchases/:path*",
    "/profile/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/api/:path*",
  ],
};