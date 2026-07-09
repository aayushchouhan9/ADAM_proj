import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';
import { isCompletedThisWeek } from '@/lib/dates';

export const GET = guard(async () => {
  const user = await currentUser();
  if (!user) return fail(401, 'Unauthorized');

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('status, estimate_hours, assignee, completed_date');

  if (error) return fail(500, 'Database error: ' + error.message);

  // Tasks per status
  const byStatus: Record<string, number> = {
    Backlog: 0, 'In Progress': 0, Review: 0, Done: 0,
  };

  // Hours per assignee
  const hoursByAssignee: Record<string, number> = {};

  // Hours completed this week
  let completedThisWeek = 0;

  for (const t of tasks || []) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;

    const assignee = t.assignee || 'Unassigned';
    hoursByAssignee[assignee] = (hoursByAssignee[assignee] || 0) + (t.estimate_hours || 0);

    if (t.status === 'Done' && isCompletedThisWeek(t.completed_date)) {
      completedThisWeek += t.estimate_hours || 0;
    }
  }

  return ok({
    byStatus,
    hoursByAssignee,
    completedThisWeek,
    totalTasks: tasks?.length || 0,
  });
});
