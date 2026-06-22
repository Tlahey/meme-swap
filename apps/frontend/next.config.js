/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  pageExtensions: process.env.NODE_ENV === 'production' ? ['tsx'] : ['js', 'jsx', 'ts', 'tsx'],
};

export default nextConfig;
