import { subscribeChange } from '@/lib/events';
import { currentUser } from '@/lib/auth';
import { fail } from '@/lib/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, 'Unauthorized');

  const stream = new ReadableStream({
    start(controller) {
      // Send a heartbeat immediately
      const enc = new TextEncoder();
      controller.enqueue(enc.encode('data: connected\n\n'));

      // Subscribe to change events
      const unsubscribe = subscribeChange(() => {
        try {
          controller.enqueue(enc.encode('data: change\n\n'));
        } catch {
          // Client disconnected
        }
      });

      // Heartbeat every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Cleanup on close
      return () => {
        unsubscribe();
        clearInterval(heartbeat);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
