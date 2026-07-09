import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { currentUser } from '@/lib/auth';
import { cleanTasks } from '@/lib/clean';
import { ok, fail, guard } from '@/lib/response';
import { notifyChange } from '@/lib/events';

export const POST = guard(async () => {
  // 1. Authenticate user
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Authentication required');
  }

  // 2. Read dirty task seed data
  let rawData: any[] = [];
  try {
    const filePath = path.join(process.cwd(), 'src/data/tasks.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    rawData = JSON.parse(content);
  } catch (err: any) {
    console.error('Error reading tasks.json for board reset:', err);
    return fail(500, 'Error reading seed file: ' + err.message);
  }

  // 3. Clean raw tasks
  const { cleaned, issuesFixed, tasksLoaded } = cleanTasks(rawData);

  // 4. Wipe tasks table
  const { error: wipeError } = await supabase
    .from('tasks')
    .delete()
    .neq('id', '');

  if (wipeError) {
    console.error('Error wiping tasks during reset:', wipeError);
    return fail(500, 'Database error while wiping tasks: ' + wipeError.message);
  }

  // 5. Bulk insert cleaned tasks
  const tasksToInsert = cleaned.map((task) => ({
    ...task,
    created_by: user.userId,
  }));

  const { error: insertError } = await supabase
    .from('tasks')
    .insert(tasksToInsert);

  if (insertError) {
    console.error('Error inserting tasks during reset:', insertError);
    return fail(500, 'Database error while inserting tasks: ' + insertError.message);
  }

  // 6. Log activity
  const { error: logError } = await supabase
    .from('activity_log')
    .insert({
      user_id: user.userId,
      action: 'reset',
      from_status: String(issuesFixed),
      to_status: String(tasksLoaded),
    });

  if (logError) {
    console.warn('Non-fatal: Error logging reset activity:', logError);
  }

  // 7. Notify client-side real-time stream
  notifyChange();

  return ok({
    issuesFixed,
    tasksLoaded,
  });
});
