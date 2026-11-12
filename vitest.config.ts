import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
    exclude: ["**/__tests__/integration/**", "supabase/tests/**", "node_modules/**", ".next/**", ".claude/**", ".worktrees/**"],
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "https://localhost" },
    },
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      NEXT_PUBLIC_APP_URL: "https://localhost:3000",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      NEXT_PUBLIC_PUBLIC_MEDIA_BASE_URL: "https://cdn.test.example.com",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "./__tests__/__mocks__/server-only.ts"),
      "@upstash/redis": path.resolve(__dirname, "./__tests__/__mocks__/upstash-redis.ts"),
    },
  },
});
