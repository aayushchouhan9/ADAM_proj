import { NextResponse } from 'next/server';

/**
 * Standard successful JSON API response
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(
    { ok: true, data },
    { status }
  );
}

/**
 * Standard failed JSON API response
 */
export function fail(status: number, error: string) {
  return NextResponse.json(
    { ok: false, error },
    { status }
  );
}

/**
 * Route handler error guard wrapper.
 * Catches unhandled exceptions, logs them, and returns a standard fail response.
 */
export function guard(
  handler: (req: Request, context: any) => Promise<Response>
) {
  return async (req: Request, context: any) => {
    try {
      return await handler(req, context);
    } catch (err: any) {
      console.error('API Router Error:', err);
      const status = err.status || 500;
      const message = err.message || 'Internal Server Error';
      return fail(status, message);
    }
  };
}
