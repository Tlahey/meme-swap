/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  pageExtensions: process.env.NODE_ENV === 'production' ? ['tsx'] : ['js', 'jsx', 'ts', 'tsx'],
};

export default nextConfig;
