import os from "node:os";
import type { NextConfig } from "next";

function isPrivateIpv4(host: string) {
  if (host.startsWith("10.") || host.startsWith("192.168.")) {
    return true;
  }

  const parts = host.split(".").map((part) => Number(part));
  return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function collectLanHosts() {
  const interfaces = os.networkInterfaces();
  const hosts = new Set<string>();

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue;
      }

      if (isPrivateIpv4(address.address)) {
        hosts.add(address.address);
      }
    }
  }

  return Array.from(hosts).sort();
}

function parseAllowedDevOrigins() {
  const configured = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...configured, ...collectLanHosts()]));
}

const nextConfig: NextConfig = {
  allowedDevOrigins: parseAllowedDevOrigins(),
  serverExternalPackages: ["discord.js"],
  images: {
    remotePatterns: []
  }
};

export default nextConfig;
