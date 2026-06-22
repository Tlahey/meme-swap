/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@meme-swap/video-processor', '@meme-swap/faceswap-core'],
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
  async rewrites() {
    const mcpPort = process.env.MCP_PORT || '3001';
    return [
      {
        source: '/mcp',
        destination: `http://127.0.0.1:${mcpPort}/mcp`,
      },
      {
        source: '/mcp/:path*',
        destination: `http://127.0.0.1:${mcpPort}/mcp/:path*`,
      },
      {
        source: '/message',
        destination: `http://127.0.0.1:${mcpPort}/message`,
      },
      {
        source: '/message/:path*',
        destination: `http://127.0.0.1:${mcpPort}/message/:path*`,
      },
    ];
  },
};

export default nextConfig;
