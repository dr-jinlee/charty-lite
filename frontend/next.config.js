/** @type {import('next').NextConfig} */
const nextConfig = {
  // 백엔드 API 프록시 (CORS 우회)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
