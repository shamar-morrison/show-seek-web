import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ignored: ["**/node_modules/**", "**/.next/**", "**/.git/**"],
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
}

export default nextConfig
