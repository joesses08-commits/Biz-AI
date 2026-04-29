/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/warehouse/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://warehouse.myjimmy.ai" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
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
      {
        source: '/(.*)',
        headers: [
          // Prevents clickjacking — stops your app being embedded in iframes on other sites
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevents MIME type sniffing attacks
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Forces HTTPS for 2 years, includes subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Stops referrer info leaking to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restricts which browser features the app can use
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          // Content Security Policy — controls what resources can load
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
              "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://gmail.googleapis.com https://www.googleapis.com https://graph.microsoft.com https://quickbooks.api.intuit.com https://api.stripe.com https://oauth2.googleapis.com",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
