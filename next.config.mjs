/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['node-forge', 'node:crypto', '@react-pdf/renderer'],
  },
}

export default nextConfig
