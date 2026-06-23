import { NextResponse } from 'next/server';

export async function GET() {
  const configured = typeof process.env.GIPHY_API_KEY === 'string' && process.env.GIPHY_API_KEY.trim().length > 0;
  return NextResponse.json({ configured });
}
