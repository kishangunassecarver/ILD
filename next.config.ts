import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static export — content is baked in at build time from WordPress, so there is
  // no runtime dependency on the CMS. Deploys anywhere static files are served.
  output: "export",
  trailingSlash: true,
  images: {
    // The static exporter has no image optimisation server.
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
