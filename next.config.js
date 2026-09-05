/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: 'output: standalone' removed — it is meant for self-hosted/Docker
  // deployments and causes Vercel to skip Vercel-optimised tracing. Vercel
  // handles the build target automatically.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Keep native / dynamic-import packages out of the bundle so their runtime
  // FS lookups (pdf-parse) and native drivers (mongodb) keep working on Vercel.
  serverExternalPackages: ['mongodb', 'pdf-parse'],
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
