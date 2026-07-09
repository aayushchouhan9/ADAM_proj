'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, UserRole } from '@/lib/types';
import { isCompletedThisWeek } from '@/lib/dates';
import { DroppableColumn } from '@/components/board/DroppableColumn';
import { SortableCard } from '@/components/board/SortableCard';
import { TaskModal } from '@/components/TaskModal';
import { ToastContainer, ToastItem } from '@/components/Toast';
import { useLive } from '@/components/useLive';

const COLUMNS: TaskStatus[] = ['Backlog', 'In Progress', 'Review', 'Done'];
const WIP_LIMITS: Partial<Record<TaskStatus, number>> = { 'In Progress': 5, Review: 3 };

type UndoEntry = { taskId: string; fromStatus: TaskStatus; fromPosition: number; toStatus: TaskStatus; toPosition: number };

let toastSeq = 0;

export default function BoardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [user, setUser] = useState<{ userId: string; name: string; email: string; role: UserRole } | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [issuesFixed, setIssuesFixed] = useState(13);
  const [tasksLoaded, setTasksLoaded] = useState(37);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Modal state
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [modalIsNew, setModalIsNew] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Mobile tab navigation
  const [activeTab, setActiveTab] = useState<TaskStatus>('Backlog');

  // DnD state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const isDragging = useRef(false);
  const [overId, setOverId] = useState<string | null>(null);

  // Undo / Redo stacks (≥10 steps)
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = String(++toastSeq);
    setToasts((prev) => [...prev.slice(-8), { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Fetch data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [userRes, tasksRes, usersRes] = await Promise.all([
        fetch('/api/users/me'),
        fetch('/api/tasks'),
        fetch('/api/users'),
      ]);

      const userResult = await userRes.json();
      if (!userRes.ok || !userResult.ok) { router.push('/login'); return; }
      setUser(userResult.data);

      const tasksResult = await tasksRes.json();
      if (tasksResult.ok) {
        setTasks(tasksResult.data.tasks || []);
        setIssuesFixed(tasksResult.data.issuesFixed);
        setTasksLoaded(tasksResult.data.tasksLoaded);
      }

      const usersResult = await usersRes.json();
      if (usersResult.ok) setUsers(usersResult.data);
    } catch (err: any) {
      addToast('Failed to load board data', 'error');
    } finally {
      setLoading(false);
    }
  }, [router, addToast]);

  useEffect(() => { fetchData(); }, []);

  // Live updates — skip during drag
  useLive(() => fetchData(true), isDragging);

  // Keyboard undo/redo
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          await handleRedo();
        } else {
          await handleUndo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // DnD sensors with 8px activation distance to allow card clicks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Helpers
  const getColumnTasks = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  const isOverdue = (task: Task) => {
    if (!task.due_date || task.status === 'Done') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(task.due_date) < today;
  };

  const getColumnStats = (status: TaskStatus) => {
    const all = tasks.filter((t) => t.status === status);
    const totalHours = all.reduce((s, t) => s + (t.estimate_hours || 0), 0);
    let extraInfo = '';
    if (status === 'Done') {
      const thisWeek = all.filter((t) => isCompletedThisWeek(t.completed_date))
        .reduce((s, t) => s + (t.estimate_hours || 0), 0);
      extraInfo = ` · ${thisWeek}h this week`;
    }
    return { count: all.length, totalHours, extraInfo };
  };

  const uniqueAssignees = Array.from(new Set(tasks.map((t) => t.assignee || 'Unassigned'))).sort();

  // Apply filters (visual only — stats always use full data)
  const filteredTasks = tasks.filter((t) => {
    const qMatch = !debouncedSearch ||
      t.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(debouncedSearch.toLowerCase());
    const aMatch = !selectedAssignees.length || selectedAssignees.includes(t.assignee || 'Unassigned');
    const oMatch = !overdueOnly || isOverdue(t);
    return qMatch && aMatch && oMatch;
  });

  // Server move call
  const callMove = async (taskId: string, toStatus: TaskStatus, toPosition: number): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch('/api/tasks/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, toStatus, toPosition }),
    });
    return res.json();
  };

  // Undo / Redo
  const handleUndo = async () => {
    const entry = undoStack.current.pop();
    if (!entry) { addToast('Nothing to undo', 'info'); return; }
    // Replay inverse
    const result = await callMove(entry.taskId, entry.fromStatus, entry.fromPosition);
    if (result.ok) {
      redoStack.current.push(entry);
      await fetchData(true);
      addToast('Undone ↩', 'success');
    } else {
      undoStack.current.push(entry);
      addToast(result.error || 'Undo failed', 'error');
    }
  };

  const handleRedo = async () => {
    const entry = redoStack.current.pop();
    if (!entry) { addToast('Nothing to redo', 'info'); return; }
    const result = await callMove(entry.taskId, entry.toStatus, entry.toPosition);
    if (result.ok) {
      undoStack.current.push(entry);
      await fetchData(true);
      addToast('Redone ↪', 'success');
    } else {
      redoStack.current.push(entry);
      addToast(result.error || 'Redo failed', 'error');
    }
  };

  // DnD handlers
  const onDragStart = (e: DragStartEvent) => {
    isDragging.current = true;
    setActiveTaskId(String(e.active.id));
  };

  const onDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    isDragging.current = false;
    setActiveTaskId(null);
    setOverId(null);

    const { active, over } = e;
    if (!over || !active) return;

    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const fromStatus = task.status;
    const fromPosition = task.position;

    // Determine target column and position
    let toStatus: TaskStatus = fromStatus;
    let toPosition = 0;

    // over.id could be a column ID or another card ID
    if (COLUMNS.includes(over.id as TaskStatus)) {
      toStatus = over.id as TaskStatus;
      toPosition = getColumnTasks(toStatus).length;
    } else {
      const overTask = tasks.find((t) => t.id === String(over.id));
      if (overTask) {
        toStatus = overTask.status;
        toPosition = overTask.position;
      }
    }

    if (fromStatus === toStatus && fromPosition === toPosition) return;

    // Check member Done restriction
    if (user?.role === 'member' && (fromStatus === 'Done' || toStatus === 'Done')) {
      addToast('⛔ Members cannot move tasks into or out of Done', 'error');
      return;
    }

    // Check WIP limits optimistically
    if (fromStatus !== toStatus) {
      const limit = WIP_LIMITS[toStatus];
      if (limit !== undefined) {
        const currentCount = tasks.filter((t) => t.status === toStatus).length;
        if (currentCount >= limit) {
          addToast(`⚠️ WIP limit reached for "${toStatus}" (max ${limit})`, 'warn');
          // Shake the card (CSS class)
          return;
        }
      }
    }

    // Optimistic UI update
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === taskId) return { ...t, status: toStatus, position: toPosition };
        return t;
      });
      return updated;
    });

    // Push to undo stack (keep ≤20 entries)
    undoStack.current = [...undoStack.current.slice(-19), { taskId, fromStatus, fromPosition, toStatus, toPosition }];
    redoStack.current = []; // Clear redo on new move

    const result = await callMove(taskId, toStatus, toPosition);
    if (!result.ok) {
      // Revert optimistic update
      addToast(result.error || 'Move failed', 'error');
      await fetchData(true);
      undoStack.current.pop();
    }
  };

  // Import / Reset
  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const res = await fetch('/api/import', { method: 'POST' });
      const r = await res.json();
      if (!r.ok) throw new Error(r.error);
      await fetchData(true);
      addToast(`✅ Imported: ${r.data.issuesFixed} issues fixed · ${r.data.tasksLoaded} tasks loaded`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset the board to original imported data? All moves will be lost.')) return;
    if (importing) return;
    setImporting(true);
    try {
      const res = await fetch('/api/board/reset', { method: 'POST' });
      const r = await res.json();
      if (!r.ok) throw new Error(r.error);
      undoStack.current = [];
      redoStack.current = [];
      await fetchData(true);
      addToast('Board reset to original data', 'success');
    } catch (err: any) {
      addToast(err.message || 'Reset failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Task CRUD handlers
  const handleSaveTask = async (data: Partial<Task>) => {
    const res = await fetch(
      modalIsNew ? '/api/tasks' : `/api/tasks/${modalTask?.id}`,
      {
        method: modalIsNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
    const r = await res.json();
    if (!r.ok) throw new Error(r.error || 'Save failed');
    await fetchData(true);
    addToast(modalIsNew ? 'Task created' : 'Task updated', 'success');
  };

  const handleDeleteTask = async () => {
    if (!modalTask) return;
    const res = await fetch(`/api/tasks/${modalTask.id}`, { method: 'DELETE' });
    const r = await res.json();
    if (!r.ok) throw new Error(r.error || 'Delete failed');
    await fetchData(true);
    addToast('Task deleted', 'success');
  };

  const activeTask = tasks.find((t) => t.id === activeTaskId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060312]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[#00f5ff]/20 border-t-[#00f5ff] animate-spin" />
          <p className="text-slate-400 font-medium">Loading Sprintly...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060312] text-white flex flex-col font-sans select-none">
      {/* Header */}
      <header className="shrink-0 bg-[#0a051b]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-4 flex-wrap">
          <a href="/board" className="text-2xl font-black bg-gradient-to-r from-[#00f5ff] to-[#8a2be2] bg-clip-text text-transparent">
            Sprintly
          </a>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#00f5ff]/10 border border-[#00f5ff]/20 text-[#00f5ff]">
            {issuesFixed} issues fixed · {tasksLoaded} tasks loaded
          </span>
          <a href="/dashboard" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
            Dashboard →
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
            className="px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all cursor-pointer"
          >
            ↩ Undo
          </button>
          <button
            onClick={handleRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="px-3 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all cursor-pointer"
          >
            ↪ Redo
          </button>

          <button onClick={handleImport} disabled={importing}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50">
            {importing ? 'Working...' : 'Import Raw'}
          </button>
          <button onClick={handleReset} disabled={importing}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#8a2be2]/25 border border-[#8a2be2]/30 text-[#e0aaff] hover:bg-[#8a2be2]/35 transition-all cursor-pointer disabled:opacity-50">
            Reset Board
          </button>

          {/* Create task button — manager/admin only */}
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <button
              onClick={() => { setModalTask(null); setModalIsNew(true); }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#8a2be2] to-[#00f5ff] hover:opacity-90 transition-all cursor-pointer"
            >
              + New Task
            </button>
          )}

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {user && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-bold text-slate-200">{user.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00f5ff]">{user.role}</span>
              </div>
              <button onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold bg-red-950/20 border border-red-900/40 text-red-300 hover:bg-red-950/40 transition-all cursor-pointer">
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Filter Bar */}
      <section className="shrink-0 bg-[#0d0925]/30 border-b border-white/5 px-6 py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="Search tasks... (300ms debounce)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            {uniqueAssignees.map((name) => {
              const sel = selectedAssignees.includes(name);
              return (
                <button key={name} onClick={() => setSelectedAssignees(
                  sel ? selectedAssignees.filter((a) => a !== name) : [...selectedAssignees, name]
                )}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border cursor-pointer ${
                    sel ? 'bg-[#00f5ff] border-[#00f5ff] text-[#060312]' : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer" />
          <span className="text-sm font-semibold text-slate-300">Overdue only</span>
        </label>
      </section>

      {/* Mobile Column Tabs */}
      <div className="flex md:hidden border-b border-white/5 bg-[#0d0925]/30 overflow-x-auto shrink-0">
        {COLUMNS.map((col) => {
          const stats = getColumnStats(col);
          return (
            <button key={col} onClick={() => setActiveTab(col)}
              className={`flex-1 py-3 px-2 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer -mb-px ${
                activeTab === col ? 'border-[#00f5ff] text-[#00f5ff]' : 'border-transparent text-slate-400'
              }`}
            >
              {col} ({stats.count})
            </button>
          );
        })}
      </div>

      {/* Board */}
      <main className="flex-1 p-6 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="h-full flex flex-col md:flex-row gap-5 items-stretch">
            {COLUMNS.map((col) => {
              const columnTasks = filteredTasks.filter((t) => t.status === col).sort((a, b) => a.position - b.position);
              const isLocked = col === 'Done' && user?.role === 'member';
              const isMobileHidden = activeTab !== col;

              return (
                <DroppableColumn
                  key={col}
                  status={col}
                  tasks={columnTasks}
                  columnStats={getColumnStats(col)}
                  onCardClick={(task) => { setModalTask(task); setModalIsNew(false); }}
                  isLocked={isLocked}
                  isMobileHidden={isMobileHidden}
                />
              );
            })}
          </div>

          {/* Drag overlay — shows a floating ghost card while dragging */}
          <DragOverlay>
            {activeTask && (
              <div className="opacity-90 rotate-1 scale-105">
                <SortableCard task={activeTask} onClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Task Modal */}
      {(modalTask !== null || modalIsNew) && (
        <TaskModal
          task={modalTask}
          isNew={modalIsNew}
          userRole={user?.role || 'member'}
          userId={user?.userId || ''}
          users={users}
          onClose={() => { setModalTask(null); setModalIsNew(false); }}
          onSave={handleSaveTask}
          onDelete={modalTask ? handleDeleteTask : undefined}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
