import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
// This app is built with `output: 'export'` in production (see next.config.ts) —
// static export requires opted-in static generation for dynamic route handlers.
// The image never varies per-request, so force-static is correct here.
export const dynamic = 'force-static';

export const alt = 'Meme Swap — Your face. Any meme.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Reuses the app icon (app/icon.png) as the badge so there is a single
// source of truth for the app's mark instead of reaching outside this
// package into website/assets at render time.
export default async function Image() {
  const iconData = await readFile(join(process.cwd(), 'app', 'icon.png'));
  const iconSrc = `data:image/png;base64,${iconData.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          backgroundImage:
            'radial-gradient(circle at 50% 32%, rgba(16, 185, 129, 0.22), rgba(9, 9, 11, 0) 60%)',
          fontFamily: 'sans-serif',
        }}
      >
        <img
          src={iconSrc}
          alt=""
          width={168}
          height={168}
          style={{
            borderRadius: 37,
            boxShadow: '0 0 0 1px rgba(250, 250, 250, 0.08)',
            marginBottom: 44,
          }}
        />
        <div
          style={{
            display: 'flex',
            color: '#fafafa',
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          Meme Swap
        </div>
        <div
          style={{
            display: 'flex',
            color: '#10b981',
            fontSize: 44,
            fontWeight: 600,
            marginTop: 22,
          }}
        >
          Your face. Any meme.
        </div>
      </div>
    ),
    { ...size }
  );
}
