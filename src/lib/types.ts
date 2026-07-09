export type UserRole = 'admin' | 'manager' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  created_at: string;
}

export type TaskStatus = 'Backlog' | 'In Progress' | 'Review' | 'Done';
export type TaskPriority = 'low' | 'med' | 'high';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignee: string;
  priority: TaskPriority;
  labels: string[];
  due_date?: string;
  estimate_hours: number;
  completed_date?: string;
  position: number;
  has_warning: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  text: string;
  created_at: string;
  user?: {
    name: string;
    avatar?: string;
    email: string;
  };
}

export type ActivityAction =
  | 'created'
  | 'moved'
  | 'completed'
  | 'reordered'
  | 'assigned'
  | 'unassigned'
  | 'deleted'
  | 'imported'
  | 'reset';

export interface ActivityLog {
  id: string;
  task_id?: string;
  user_id?: string;
  action: ActivityAction;
  from_status?: string;
  to_status?: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
  task?: {
    title: string;
  };
}

export interface JWTPayload {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
}
