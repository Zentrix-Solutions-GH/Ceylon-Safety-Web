import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // R2 public bucket and YouTube thumbnails added during S-001 infra setup
    ],
  },
  async headers() {
    return [
      {
        source: "/(admin|cart|checkout|download|purchases|profile|api)(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
};

export default nextConfig;