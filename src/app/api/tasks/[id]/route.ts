import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';
import { notifyChange } from '@/lib/events';

// Zod Validation Schema for Task Edits (Strict - no status or position allowed)
const patchTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.enum(['low', 'med', 'high']).optional(),
  labels: z.array(z.string()).optional(),
  due_date: z.string().nullable().optional(),
  estimate_hours: z.number().min(0, 'Estimate hours must be 0 or greater').optional(),
}).strict();

// PATCH Handler: Edit task content (Manager/Admin only, strict content validation)
export const PATCH = guard(async (req: Request, context: { params: Promise<{ id: string }> }) => {
  // 1. Authenticate and authorize user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  if (user.role === 'member') {
    return fail(403, 'Forbidden: Members cannot edit tasks');
  }

  // 2. Resolve parameters & validate input payload
  const { id } = await context.params;
  const body = await req.json();
  const parsed = patchTaskSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return fail(400, 'Invalid request body: ' + errors);
  }

  const updates = parsed.data;

  // 3. Fetch existing task to compare assignee changes and check existence
  const { data: existingTask, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching existing task:', fetchError);
    return fail(500, 'Database error while retrieving task details');
  }

  if (!existingTask) {
    return fail(404, 'Task not found');
  }

  // 4. Update the task record
  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError || !updatedTask) {
    console.error('Error updating task:', updateError);
    return fail(500, updateError?.message || 'Database error during task update');
  }

  // 5. Check and log assignee changes (assigned / unassigned)
  if (updates.assignee !== undefined && updates.assignee !== existingTask.assignee) {
    const oldAssignee = existingTask.assignee || 'Unassigned';
    const newAssignee = updates.assignee || 'Unassigned';

    let action: 'assigned' | 'unassigned' = 'assigned';
    if (newAssignee === 'Unassigned') {
      action = 'unassigned';
    }

    await supabase.from('activity_log').insert({
      task_id: id,
      user_id: user.userId,
      action,
      from_status: oldAssignee,
      to_status: newAssignee,
    });
  }

  // 6. Notify client-side real-time stream
  notifyChange();

  return ok(updatedTask);
});

// DELETE Handler: Delete a task (Manager/Admin only)
export const DELETE = guard(async (req: Request, context: { params: Promise<{ id: string }> }) => {
  // 1. Authenticate and authorize user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  if (user.role === 'member') {
    return fail(403, 'Forbidden: Members cannot delete tasks');
  }

  const { id } = await context.params;

  // 2. Verify task existence
  const { data: existingTask, error: fetchError } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return fail(500, 'Database error validating task existence');
  }

  if (!existingTask) {
    return fail(404, 'Task not found');
  }

  // 3. Delete task (Cascade delete will remove comments)
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error deleting task:', deleteError);
    return fail(500, 'Database error during task deletion: ' + deleteError.message);
  }

  // 4. Log deletion activity
  await supabase.from('activity_log').insert({
    task_id: null, // Task no longer exists
    user_id: user.userId,
    action: 'deleted',
    from_status: id, // Log deleted task ID as context
  });

  // 5. Notify client-side real-time stream
  notifyChange();

  return ok({
    message: 'Task deleted successfully',
  });
});
