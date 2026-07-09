import { Task, TaskStatus, TaskPriority } from './types';

export interface CleanResult {
  cleaned: Partial<Task>[];
  issuesFixed: number;
  tasksLoaded: number;
}

/**
 * Parses and sanitizes a date string supporting three formats:
 * - YYYY-MM-DD (e.g. 2026-06-10)
 * - DD/MM/YYYY (e.g. 10/06/2026)
 * - Month Day, Year (e.g. June 5, 2026)
 */
export function parseDate(dateVal: any): string | null {
  if (dateVal === null || dateVal === undefined) return null;
  const s = String(dateVal).trim();
  if (s === '' || s.toLowerCase() === 'null') return null;

  // 1. Matches YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // 2. Matches DD/MM/YYYY (or D/M/YYYY)
  const ddmmyyyyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    // Create Date at noon to avoid local timezone offset shifting the date
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // 3. Fallback to standard parsing (e.g., June 5, 2026)
  const parsedTime = Date.parse(s);
  if (!isNaN(parsedTime)) {
    return new Date(parsedTime).toISOString();
  }

  return null;
}

/**
 * Pure data cleaning function for the tasks.json seed data.
 */
export function cleanTasks(rawTasks: any[]): CleanResult {
  let issuesFixed = 0;

  // 1. Deduplication: Keep the record appearing LATER, discard earlier.
  // Group by ID and keep the last one.
  const uniqueTasksMap = new Map<string, any>();
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  // Track duplicates: if we see an ID we've seen before, that's a duplicate.
  // Let's count them.
  for (const t of rawTasks) {
    if (t && t.id) {
      if (seenIds.has(t.id)) {
        duplicateCount++;
      }
      seenIds.add(t.id);
      uniqueTasksMap.set(t.id, t);
    }
  }
  
  // Each duplicate removed counts as an issue fixed
  issuesFixed += duplicateCount;

  const uniqueTasks = Array.from(uniqueTasksMap.values());
  const cleaned: Partial<Task>[] = [];
  const statusCounters: Record<string, number> = {};

  for (const task of uniqueTasks) {
    let hasWarning = task.has_warning || false;

    // 2. Fix assignee
    let assignee = task.assignee;
    let isAssigneeFixed = false;
    if (assignee === null || assignee === undefined) {
      assignee = 'Unassigned';
      isAssigneeFixed = true;
    } else {
      const s = String(assignee).trim();
      if (s === '' || s === 'N/A' || s === 'n/a' || s.toLowerCase() === 'null') {
        assignee = 'Unassigned';
        isAssigneeFixed = true;
      }
    }
    if (isAssigneeFixed) {
      issuesFixed++;
    }

    // 3. Fix estimate hours
    let estimate = task.estimate_hours;
    let isEstimateFixed = false;
    if (estimate === null || estimate === undefined) {
      estimate = 0;
      isEstimateFixed = true;
    } else if (typeof estimate === 'number') {
      if (estimate < 0) {
        estimate = 0;
        isEstimateFixed = true;
      }
    } else if (typeof estimate === 'string') {
      const s = estimate.trim();
      const num = Number(s);
      if (isNaN(num)) {
        estimate = 0;
        isEstimateFixed = true;
      } else if (num < 0) {
        estimate = 0;
        isEstimateFixed = true;
      } else {
        estimate = num; // Valid numeric string parses to number, no issue counted
      }
    } else {
      estimate = 0;
      isEstimateFixed = true;
    }
    if (isEstimateFixed) {
      issuesFixed++;
    }

    // 4. Fix status
    let status = task.status;
    let isStatusFixed = false;
    const statusUpperMap: Record<string, TaskStatus> = {
      'BACKLOG': 'Backlog',
      'IN PROGRESS': 'In Progress',
      'REVIEW': 'Review',
      'DONE': 'Done',
    };

    if (!status || typeof status !== 'string') {
      status = 'Backlog';
      hasWarning = true;
      isStatusFixed = true;
    } else {
      const upper = status.trim().toUpperCase();
      if (statusUpperMap[upper]) {
        status = statusUpperMap[upper]; // Silently normalized (no issue counted)
      } else {
        status = 'Backlog';
        hasWarning = true;
        isStatusFixed = true;
      }
    }
    if (isStatusFixed) {
      issuesFixed++;
    }

    // 5. Parse dates
    const dueDate = parseDate(task.due_date);
    let completedDate = parseDate(task.completed_date);

    // If status is Done and completed_date is missing, set it to now
    if (status === 'Done' && !completedDate) {
      completedDate = new Date().toISOString();
    }

    // 6. Compute column positions dynamically
    const currentStatus = status as string;
    if (statusCounters[currentStatus] === undefined) {
      statusCounters[currentStatus] = 0;
    }
    const position = statusCounters[currentStatus];
    statusCounters[currentStatus]++;

    // 7. Structure the clean record
    cleaned.push({
      id: task.id,
      title: task.title || 'Untitled Task',
      description: task.description || '',
      status: status as TaskStatus,
      assignee,
      priority: (task.priority || 'low') as TaskPriority,
      labels: Array.isArray(task.labels) ? task.labels : [],
      due_date: dueDate || undefined,
      estimate_hours: estimate,
      completed_date: completedDate || undefined,
      position,
      has_warning: hasWarning,
    });
  }

  return {
    cleaned,
    issuesFixed,
    tasksLoaded: cleaned.length,
  };
}
