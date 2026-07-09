import fs from 'fs';
import path from 'path';
import { cleanTasks } from '../lib/clean';

try {
  // Read tasks.json raw seed data
  const filePath = path.join(process.cwd(), 'src/data/tasks.json');
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Clean raw tasks
  const result = cleanTasks(rawData);

  console.log('--- Clean Data Verification ---');
  console.log(`Issues Fixed: ${result.issuesFixed}`);
  console.log(`Tasks Loaded: ${result.tasksLoaded}`);
  console.log('-------------------------------');

  // Assert output sizes
  if (result.issuesFixed !== 13) {
    throw new Error(`Expected 13 issues fixed, but got ${result.issuesFixed}`);
  }
  if (result.tasksLoaded !== 37) {
    throw new Error(`Expected 37 tasks loaded, but got ${result.tasksLoaded}`);
  }

  // Assert deduplication (TASK-001)
  const task001 = result.cleaned.find((t) => t.id === 'TASK-001');
  if (!task001) {
    throw new Error('TASK-001 was not found in cleaned list');
  }
  if (task001.title !== 'Clean Task 1') {
    throw new Error(`Expected TASK-001 title to be 'Clean Task 1' (the later record), but got '${task001.title}'`);
  }

  // Assert assignee cleaning (TASK-002)
  const task002 = result.cleaned.find((t) => t.id === 'TASK-002');
  if (!task002 || task002.assignee !== 'Unassigned') {
    throw new Error(`Expected TASK-002 assignee to be 'Unassigned', but got '${task002?.assignee}'`);
  }

  // Assert estimate cleaning (TASK-006)
  const task006 = result.cleaned.find((t) => t.id === 'TASK-006');
  if (!task006 || task006.estimate_hours !== 0) {
    throw new Error(`Expected TASK-006 estimate_hours to be 0 (repaired from negative), but got '${task006?.estimate_hours}'`);
  }

  // Assert status repair & warning flag (TASK-011)
  const task011 = result.cleaned.find((t) => t.id === 'TASK-011');
  if (!task011 || task011.status !== 'Backlog' || !task011.has_warning) {
    throw new Error(`Expected TASK-011 status to be 'Backlog' with has_warning: true, but got status '${task011?.status}' and has_warning '${task011?.has_warning}'`);
  }

  // Assert silent status normalization (TASK-014)
  const task014 = result.cleaned.find((t) => t.id === 'TASK-014');
  if (!task014 || task014.status !== 'In Progress') {
    throw new Error(`Expected TASK-014 status to be 'In Progress' (repaired silently from 'in progress'), but got '${task014?.status}'`);
  }

  console.log('✅ UNIT TEST PASSED: 13 issues fixed · 37 tasks loaded');
  process.exit(0);
} catch (error: any) {
  console.error('❌ UNIT TEST FAILED:', error.message);
  process.exit(1);
}
