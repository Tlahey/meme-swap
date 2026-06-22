import { NextResponse } from 'next/server';

export async function GET() {
  const mcpPort = process.env.MCP_PORT || '3001';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(`http://127.0.0.1:${mcpPort}/health`, {
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ active: true, port: mcpPort, info: data });
    }
  } catch (error) {
    // Le serveur est probablement éteint ou inaccessible
  }

  return NextResponse.json({ active: false, port: mcpPort });
}
