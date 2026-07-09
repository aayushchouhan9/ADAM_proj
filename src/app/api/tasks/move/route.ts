import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';
import { notifyChange } from '@/lib/events';
import { TaskStatus } from '@/lib/types';

const moveTaskSchema = z.object({
  taskId: z.string(),
  toStatus: z.enum(['Backlog', 'In Progress', 'Review', 'Done']),
  toPosition: z.number().min(0),
});

export const PATCH = guard(async (req: Request) => {
  // 1. Authenticate user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  // 2. Validate request body
  const body = await req.json();
  const parsed = moveTaskSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return fail(400, 'Invalid request parameters: ' + errors);
  }

  const { taskId, toStatus, toPosition } = parsed.data;

  // 3. Fetch current task detail
  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (fetchError || !task) {
    return fail(404, 'Task not found');
  }

  const fromStatus: TaskStatus = task.status;
  const fromPosition: number = task.position;

  // 4. Role Permissions check:
  // Members cannot move tasks into or out of the Done column.
  if (user.role === 'member') {
    if (fromStatus === 'Done' || toStatus === 'Done') {
      return fail(403, 'Forbidden: Members cannot move tasks into or out of the Done column');
    }
  }

  // 5. WIP limit checks (enforced only on cross-column moves)
  if (fromStatus !== toStatus) {
    if (toStatus === 'In Progress' || toStatus === 'Review') {
      const limit = toStatus === 'In Progress' ? 5 : 3;
      const { count, error: countError } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', toStatus);

      if (countError) {
        return fail(500, 'Database error checking WIP limits');
      }

      if (count !== null && count >= limit) {
        return fail(409, `Column "${toStatus}" has reached its WIP limit of ${limit} tasks`);
      }
    }
  }

  // 6. Database position reindexing
  if (fromStatus === toStatus) {
    // Case A: Same column reordering
    const { data: columnTasks, error: colError } = await supabase
      .from('tasks')
      .select('id, position')
      .eq('status', toStatus)
      .order('position', { ascending: true });

    if (colError || !columnTasks) {
      return fail(500, 'Database error fetching column tasks');
    }

    // Filter out the moved task, then insert it at its new position
    const sorted = columnTasks.filter((t) => t.id !== taskId);
    // Cap position to end of list if out of bounds
    const cappedPosition = Math.min(toPosition, sorted.length);
    sorted.splice(cappedPosition, 0, { id: taskId, position: toPosition });

    // Update positions sequentially
    for (let i = 0; i < sorted.length; i++) {
      await supabase
        .from('tasks')
        .update({ position: i, updated_at: new Date().toISOString() })
        .eq('id', sorted[i].id);
    }
  } else {
    // Case B: Cross-column move
    // 1. Reindex original column (fromStatus) by removing this task
    const { data: fromTasks, error: fromError } = await supabase
      .from('tasks')
      .select('id, position')
      .eq('status', fromStatus)
      .order('position', { ascending: true });

    if (fromError || !fromTasks) {
      return fail(500, 'Database error fetching source column tasks');
    }

    const filteredFrom = fromTasks.filter((t) => t.id !== taskId);
    for (let i = 0; i < filteredFrom.length; i++) {
      await supabase
        .from('tasks')
        .update({ position: i, updated_at: new Date().toISOString() })
        .eq('id', filteredFrom[i].id);
    }

    // 2. Reindex target column (toStatus) by inserting this task at toPosition
    const { data: toTasks, error: toError } = await supabase
      .from('tasks')
      .select('id, position')
      .eq('status', toStatus)
      .order('position', { ascending: true });

    if (toError || !toTasks) {
      return fail(500, 'Database error fetching target column tasks');
    }

    const cappedPosition = Math.min(toPosition, toTasks.length);
    const mockTask = { id: taskId, position: toPosition };
    toTasks.splice(cappedPosition, 0, mockTask);

    // Update positions sequentially, and update status & completed date on target task
    for (let i = 0; i < toTasks.length; i++) {
      const isMovedTask = toTasks[i].id === taskId;
      const updates: any = { position: i, updated_at: new Date().toISOString() };
      
      if (isMovedTask) {
        updates.status = toStatus;
        if (toStatus === 'Done') {
          updates.completed_date = new Date().toISOString();
        } else if (fromStatus === 'Done') {
          updates.completed_date = null;
        }
      }

      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', toTasks[i].id);
    }
  }

  // 7. Log activity in activity_log
  let logAction: 'reordered' | 'moved' | 'completed' = 'moved';
  if (fromStatus === toStatus) {
    logAction = 'reordered';
  } else if (toStatus === 'Done') {
    logAction = 'completed';
  }

  const { error: logError } = await supabase
    .from('activity_log')
    .insert({
      task_id: taskId,
      user_id: user.userId,
      action: logAction,
      from_status: fromStatus,
      to_status: toStatus,
    });

  if (logError) {
    console.warn('Non-fatal: Error logging task move activity:', logError);
  }

  // 8. Notify client-side real-time stream
  notifyChange();

  return ok({
    message: 'Task moved successfully',
  });
});
