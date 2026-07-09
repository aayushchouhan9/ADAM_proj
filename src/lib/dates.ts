/**
 * Determines if a given date falls within the current week's boundaries (Monday through Sunday).
 */
export function isCompletedThisWeek(dateInput: string | Date | null | undefined): boolean {
  if (!dateInput) return false;
  
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;

  const now = new Date();
  
  // 1. Get the start of the week (Monday at 00:00:00.000)
  const startOfWeek = new Date(now);
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const diffToMonday = day === 0 ? -6 : 1 - day; // Adjust to get previous/current Monday
  
  startOfWeek.setDate(now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // 2. Get the end of the week (Sunday at 23:59:59.999)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return d >= startOfWeek && d <= endOfWeek;
}

/**
 * Formats an ISO string date into a human readable format.
 */
export function formatFriendlyDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'No due date';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
