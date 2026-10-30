import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["**/__tests__/**/*.test.{ts,tsx}", "**/*.test.{ts,tsx}"],
    exclude: ["**/__tests__/integration/**", "node_modules/**", ".next/**", ".claude/**", ".worktrees/**"],
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "https://localhost" },
    },
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "./__tests__/__mocks__/server-only.ts"),
    },
  },
});
