/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
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
