import { currentUser } from '@/lib/auth';
import { ok, fail, guard } from '@/lib/response';

export const GET = guard(async () => {
  const user = await currentUser();
  if (!user) {
    return fail(401, 'Unauthorized: Not logged in');
  }
  return ok(user);
});
