import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';

export const GET = guard(async (req: Request) => {
  const user = await currentUser();
  if (!user) return fail(401, 'Unauthorized');

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const { data, error } = await supabase
    .from('activity_log')
    .select(`
      id,
      task_id,
      user_id,
      action,
      from_status,
      to_status,
      created_at,
      user:users ( name, email ),
      task:tasks ( title )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity:', error);
    return fail(500, 'Database error: ' + error.message);
  }

  return ok(data);
});
