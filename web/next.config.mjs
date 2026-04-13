/** @type {import('next').NextConfig} */
const nextConfig = {
  // Base path for production deployment behind nginx proxy
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // Asset prefix for static assets
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',

  // Standalone output for Docker deployment
  output: 'standalone',

  // Proxy backend routes through Next.js dev server
  async rewrites() {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
    const backendOrigin = apiUrl.replace(/\/api\/v1$/, '');
    return [
      {
        source: '/avatars/:path*',
        destination: `${backendOrigin}/avatars/:path*`,
      },
    ];
  },
};

export default nextConfig;
