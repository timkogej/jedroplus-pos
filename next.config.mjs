/** @type {import('next').NextConfig} */

// Security headers applied to every response. CORS is intentionally NOT set
// here: the only cross-origin endpoint (/api/stripe/checkout) negotiates its
// own per-origin CORS headers in the route handler, and the Stripe webhook is
// authenticated by signature. Every other /api/* route is same-origin and is
// already protected because no Access-Control-Allow-Origin header is emitted.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['node-forge', 'node:crypto', '@react-pdf/renderer'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
