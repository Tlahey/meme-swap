/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for the desktop app's packaged build (apps/desktop loads it via app://).
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  // `output: 'export'` can't build the `.ts` API route handlers (app/api/**/route.ts,
  // used only in dev, not in the static export) — restricting pageExtensions to `.tsx`
  // keeps Next.js from trying to treat them as routes and failing the production build.
  // If you add a new API route file, it stays dev-only and won't affect this list.
  pageExtensions: process.env.NODE_ENV === 'production' ? ['tsx'] : ['js', 'jsx', 'ts', 'tsx'],
};

export default nextConfig;
