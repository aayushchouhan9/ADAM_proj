-- Enable UUID generation extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
    avatar TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, -- Matches imported IDs or custom string format
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (status IN ('Backlog', 'In Progress', 'Review', 'Done')),
    assignee TEXT NOT NULL DEFAULT 'Unassigned',
    priority TEXT NOT NULL CHECK (priority IN ('low', 'med', 'high')),
    labels TEXT[] NOT NULL DEFAULT '{}',
    due_date TIMESTAMPTZ,
    estimate_hours INT NOT NULL DEFAULT 0,
    completed_date TIMESTAMPTZ,
    position INT NOT NULL DEFAULT 0,
    has_warning BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'moved', 'completed', 'reordered', 'assigned', 'unassigned', 'deleted', 'imported', 'reset')),
    from_status TEXT,
    to_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Users
INSERT INTO users (id, name, email, password_hash, role, avatar) VALUES
('a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e1', 'Sprintly Admin', 'admin@sprintly.com', '$2b$10$fHysny4YOK1j12T/onDqBeJzhMrEvRh3PAv2vkiK3Sy0/oUziIXci', 'admin', 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'),
('a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e2', 'Sprintly Manager', 'manager@sprintly.com', '$2b$10$2J5V2sYsOp3mDKYkxTP45eu.e3dMzXxHqY9d8YBGb18pZP5eIpIA2', 'manager', 'https://api.dicebear.com/7.x/bottts/svg?seed=manager'),
('a0e0a0e0-a0e0-a0e0-a0e0-a0e0a0e0a0e3', 'Sprintly Member', 'member@sprintly.com', '$2b$10$9n8A/HfTojQLBqEB4ynZzevVonaX/ZXTRD4q00hIhxEdnEK4Se9su', 'member', 'https://api.dicebear.com/7.x/bottts/svg?seed=member')
ON CONFLICT (email) DO NOTHING;
