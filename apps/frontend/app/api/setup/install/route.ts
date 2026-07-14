import { runFaceFusionInstall } from '@meme-swap/installer-core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/setup/install
 * Streams installation progress/logs as Server-Sent Events. Two named event
 * types are emitted: "progress" (JSON InstallProgressEvent) and "log"
 * (JSON-encoded raw text chunk), plus a final "done" event with { success }.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const success = await runFaceFusionInstall(
          (progress) => sendEvent('progress', progress),
          (text) => sendEvent('log', text),
        );
        sendEvent('done', { success });
      } catch (err) {
        sendEvent('log', `\n[ERROR] ${err instanceof Error ? err.message : String(err)}\n`);
        sendEvent('done', { success: false });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
