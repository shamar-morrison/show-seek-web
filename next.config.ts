import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

const nextConfig: NextConfig = {
  // DEV-ONLY webpack tuning
  webpack: (config) => {
    if (!isDev) return config

    config.watchOptions = {
      ignored: ["**/node_modules/**", "**/.next/**", "**/.git/**"],
    }

    return config
  },

  // Silence Next 16 Turbopack warning without forcing it
  turbopack: {},

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
