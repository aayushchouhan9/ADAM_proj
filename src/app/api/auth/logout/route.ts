import { cookies } from 'next/headers';
import { ok, guard } from '@/lib/response';

export const POST = guard(async () => {
  const cookieStore = await cookies();
  cookieStore.set('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Clears the cookie immediately
    path: '/',
  });

  return ok({
    message: 'Logged out successfully',
  });
});
