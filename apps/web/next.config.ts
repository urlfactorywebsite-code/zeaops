import type { NextConfig } from "next";

const config: NextConfig = {
  output: process.env.ZEAOPS_STANDALONE === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  transpilePackages: ["@zeaops/ui", "@zeaops/contracts", "@zeaops/api-client"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default config;
