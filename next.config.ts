import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["discord.js"],
  images: {
    remotePatterns: []
  }
};

export default nextConfig;
