import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';

export const GET = guard(async () => {
  // 1. Authenticate user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  // 2. Fetch users (omit password hash for security)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, role, avatar, created_at')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return fail(500, 'Database error while fetching users: ' + error.message);
  }

  return ok(users);
});
