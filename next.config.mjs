/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
  async headers() {
    return [
      {
        source: '/.well-known/microsoft-identity-association.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ]
  },
};

export default nextConfig;
