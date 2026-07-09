import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';
import { notifyChange } from '@/lib/events';

const createCommentSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  text: z.string().min(1, 'Comment text cannot be empty'),
});

// GET Handler: Retrieve comments for a specific task
export const GET = guard(async (req: Request) => {
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return fail(400, 'Missing taskId query parameter');
  }

  // Fetch comments and join with user info
  const { data: comments, error } = await supabase
    .from('comments')
    .select(`
      id,
      task_id,
      user_id,
      text,
      created_at,
      user:users (
        name,
        email,
        avatar
      )
    `)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    return fail(500, 'Database error while fetching comments: ' + error.message);
  }

  return ok(comments);
});

// POST Handler: Add a comment to a task (available to all authenticated users)
export const POST = guard(async (req: Request) => {
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  const body = await req.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return fail(400, errors);
  }

  const { taskId, text } = parsed.data;

  // Verify task exists before adding comment
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .maybeSingle();

  if (fetchError || !task) {
    return fail(404, 'Task not found');
  }

  // Insert comment
  const { data: comment, error: insertError } = await supabase
    .from('comments')
    .insert({
      task_id: taskId,
      user_id: user.userId,
      text,
    })
    .select(`
      id,
      task_id,
      user_id,
      text,
      created_at,
      user:users (
        name,
        email,
        avatar
      )
    `)
    .single();

  if (insertError || !comment) {
    console.error('Error creating comment:', insertError);
    return fail(500, 'Database error while posting comment');
  }

  // Notify real-time listeners of stream
  notifyChange();

  return ok(comment);
});
