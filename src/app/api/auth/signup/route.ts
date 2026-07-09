import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { signToken } from '@/lib/jwt';
import { ok, fail, guard } from '@/lib/response';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const POST = guard(async (req: Request) => {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return fail(400, errors);
  }

  const { name, email, password } = parsed.data;

  // 1. Check if user already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (checkError) {
    return fail(500, 'Database error checking user existence');
  }

  if (existingUser) {
    return fail(400, 'A user with this email already exists');
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // 3. Insert user (force role to member)
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: 'member',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
    })
    .select('id, name, email, role, avatar, created_at')
    .single();

  if (insertError || !newUser) {
    return fail(500, insertError?.message || 'Database error creating user');
  }

  // 4. Generate JWT payload & sign token
  const payload = {
    userId: newUser.id,
    role: newUser.role,
    name: newUser.name,
    email: newUser.email,
  };

  const token = await signToken(payload);

  // 5. Set Cookie
  const cookieStore = await cookies();
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60, // 2 hours
    path: '/',
  });

  return ok({
    user: newUser,
  });
});
