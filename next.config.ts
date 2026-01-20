import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@remotion/bundler', '@remotion/renderer'],
};

export default nextConfig;
