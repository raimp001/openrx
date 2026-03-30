/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  transpilePackages: ["@chenglou/pretext"],
  eslint: {
    // TODO: Fix lint backlog and set to false
    ignoreDuringBuilds: process.env.CI !== "true",
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ]
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Required: pino-pretty is a Node-only optional dep of pino (used by some deps)
      "pino-pretty": false,
      // Required: encoding is an optional dep of node-fetch used by some SDKs
      encoding: false,
      // Required: React Native storage not available in web context
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push("pino-pretty", "encoding")
    return config
  },
}

module.exports = nextConfig
