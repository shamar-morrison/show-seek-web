import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare"
import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

if (isDev) {
  void initOpenNextCloudflareForDev()
}

const nextConfig: NextConfig = {
  // DEV-ONLY webpack tuning
  webpack: (config) => {
    if (!isDev) return config

    config.watchOptions = {
      ignored: ["**/node_modules/**", "**/.next/**", "**/.git/**"],
    }

    return config
  },

  // Pin the repo root so Cloudflare/OpenNext builds don't inherit a parent lockfile.
  turbopack: {
    root: process.cwd(),
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
    ],
  },
}

export default nextConfig
