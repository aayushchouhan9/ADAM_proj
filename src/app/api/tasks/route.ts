import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';
import { notifyChange } from '@/lib/events';

// GET Handler: Retrieve all tasks ordered by position
export const GET = guard(async () => {
  // 1. Authenticate user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  // 2. Fetch tasks ordered by position
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return fail(500, 'Database error while fetching tasks: ' + error.message);
  }

  // 3. Fetch latest import / reset stats for Data Health badge
  const { data: latestImport } = await supabase
    .from('activity_log')
    .select('from_status, to_status')
    .in('action', ['imported', 'reset'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const issuesFixed = latestImport?.from_status ? parseInt(latestImport.from_status, 10) : 13;
  const tasksLoaded = latestImport?.to_status ? parseInt(latestImport.to_status, 10) : 37;

  return ok({
    tasks,
    issuesFixed,
    tasksLoaded,
  });
});

// Zod Validation Schema for Task Creation
const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['Backlog', 'In Progress', 'Review', 'Done']).default('Backlog'),
  assignee: z.string().default('Unassigned'),
  priority: z.enum(['low', 'med', 'high']).default('low'),
  labels: z.array(z.string()).default([]),
  due_date: z.string().nullable().optional(),
  estimate_hours: z.number().min(0, 'Estimate hours must be 0 or greater').default(0),
});

// POST Handler: Create a new task (Manager/Admin only, enforces WIP limits)
export const POST = guard(async (req: Request) => {
  // 1. Authenticate and authorize user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  if (user.role === 'member') {
    return fail(403, 'Forbidden: Members cannot create tasks');
  }

  // 2. Validate input payload
  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => i.message).join(', ');
    return fail(400, errors);
  }

  const { title, description, status, assignee, priority, labels, due_date, estimate_hours } = parsed.data;

  // 3. Enforce WIP limits on target column (In Progress <= 5, Review <= 3)
  if (status === 'In Progress' || status === 'Review') {
    const limit = status === 'In Progress' ? 5 : 3;
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);

    if (countError) {
      console.error('WIP limit check error:', countError);
      return fail(500, 'Database error checking WIP limits');
    }

    if (count !== null && count >= limit) {
      return fail(409, `Column "${status}" has reached its WIP limit of ${limit} tasks`);
    }
  }

  // 4. Calculate position at the end of target column
  const { count: positionCount, error: posError } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', status);

  if (posError) {
    console.error('Position calculation error:', posError);
    return fail(500, 'Database error calculating task position');
  }

  const position = positionCount || 0;
  const taskId = 'TASK-' + Math.random().toString(36).substring(2, 7).toUpperCase();

  // 5. Insert Task
  const { data: newTask, error: insertError } = await supabase
    .from('tasks')
    .insert({
      id: taskId,
      title,
      description,
      status,
      assignee,
      priority,
      labels,
      due_date: due_date || null,
      estimate_hours,
      completed_date: status === 'Done' ? new Date().toISOString() : null,
      position,
      has_warning: false,
      created_by: user.userId,
    })
    .select('*')
    .single();

  if (insertError || !newTask) {
    console.error('Task creation error:', insertError);
    return fail(500, insertError?.message || 'Database error during task creation');
  }

  // 6. Log Activity Log entries (creation and optional assignment)
  await supabase.from('activity_log').insert({
    task_id: taskId,
    user_id: user.userId,
    action: 'created',
  });

  if (assignee && assignee !== 'Unassigned') {
    await supabase.from('activity_log').insert({
      task_id: taskId,
      user_id: user.userId,
      action: 'assigned',
      from_status: 'Unassigned',
      to_status: assignee,
    });
  }

  // 7. Notify client-side real-time stream
  notifyChange();

  return ok(newTask);
});
