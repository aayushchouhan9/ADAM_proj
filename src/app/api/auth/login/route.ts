import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { signToken } from '@/lib/jwt';
import { ok, fail, guard } from '@/lib/response';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const POST = guard(async (req: Request) => {
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return fail(400, errors);
  }

  const { email, password } = parsed.data;

  // 1. Fetch user from database
  const { data: user, error: dbError } = await supabase
    .from('users')
    .select('id, name, email, password_hash, role, avatar, created_at')
    .eq('email', email)
    .maybeSingle();

  if (dbError) {
    return fail(500, 'Database error during login');
  }

  if (!user) {
    return fail(401, 'Invalid email or password');
  }

  // 2. Compare password hashes
  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return fail(401, 'Invalid email or password');
  }

  // 3. Generate JWT payload & sign token
  const payload = {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  };

  const token = await signToken(payload);

  // 4. Set Cookie
  const cookieStore = await cookies();
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60, // 2 hours
    path: '/',
  });

  // Extract password_hash out of returned data
  const { password_hash, ...userSafe } = user;

  return ok({
    user: userSafe,
  });
});
