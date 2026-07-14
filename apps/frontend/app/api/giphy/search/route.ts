import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const key = process.env.GIPHY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'GIPHY_API_KEY is not configured on the server.' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = searchParams.get('limit') || '8';
  const offset = searchParams.get('offset') || '0';

  try {
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&rating=g`;
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Giphy API responded with an error' },
        { status: response.status },
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search Giphy' },
      { status: 500 },
    );
  }
}
