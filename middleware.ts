export { default } from "@/lib/auth/middleware";

export const config = {
  matcher: [
    "/admin/:path*",
    "/cart",
    "/checkout/:path*",
    "/download/:path*",
    "/purchases/:path*",
    "/profile/:path*",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/verify-email",
    "/reset-password",
    "/api/:path*",
  ],
};
