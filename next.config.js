/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0, must-revalidate",
          },
          {
            key: "CDN-Cache-Control",
            value: "no-store",
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: "no-store",
          },
        ],
      },
    ]
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      encoding: false,
      "@react-native-async-storage/async-storage": false,
    }
    config.externals.push("pino-pretty", "encoding")
    return config
  },
}

module.exports = nextConfig
