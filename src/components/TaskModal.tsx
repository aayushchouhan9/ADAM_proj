'use client';

import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus, UserRole, Comment } from '@/lib/types';
import { formatFriendlyDate } from '@/lib/dates';

interface TaskModalProps {
  task: Task | null;
  isNew: boolean;
  userRole: UserRole;
  userId: string;
  users: { name: string; email: string; id: string }[];
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function TaskModal({
  task,
  isNew,
  userRole,
  userId,
  users,
  onClose,
  onSave,
  onDelete,
}: TaskModalProps) {
  const canEdit = userRole === 'admin' || userRole === 'manager';

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [assignee, setAssignee] = useState(task?.assignee || 'Unassigned');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'low');
  const [labelsInput, setLabelsInput] = useState((task?.labels || []).join(', '));
  const [dueDate, setDueDate] = useState(
    task?.due_date ? task.due_date.split('T')[0] : ''
  );
  const [estimateHours, setEstimateHours] = useState<number>(task?.estimate_hours ?? 0);
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'Backlog');

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');

  // Unique assignee names from users + task assignees that aren't in user list
  const assigneeOptions = [
    'Unassigned',
    ...users.map((u) => u.name),
  ];

  // Load comments when viewing an existing task
  useEffect(() => {
    if (!isNew && task?.id) {
      setLoadingComments(true);
      fetch(`/api/comments?taskId=${task.id}`)
        .then((r) => r.json())
        .then((r) => {
          if (r.ok) setComments(r.data);
        })
        .catch(console.error)
        .finally(() => setLoadingComments(false));
    }
  }, [task?.id, isNew]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setError(null);
    setSaving(true);
    try {
      const payload: Partial<Task> = {
        title,
        description,
        assignee,
        priority,
        labels: labelsInput.split(',').map((l) => l.trim()).filter(Boolean),
        due_date: dueDate || undefined,
        estimate_hours: estimateHours,
        ...(isNew ? { status } : {}),
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !canEdit) return;
    if (!confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Delete failed');
      setDeleting(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !task?.id) return;
    setPostingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, text: commentText.trim() }),
      });
      const result = await res.json();
      if (result.ok) {
        setComments((prev) => [...prev, result.data]);
        setCommentText('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0925] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-lg text-white">
            {isNew ? 'Create Task' : canEdit ? 'Edit Task' : 'Task Details'}
          </h2>
          <div className="flex items-center gap-2">
            {!isNew && canEdit && onDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-sm font-semibold text-red-300 bg-red-950/30 border border-red-800/30 rounded-lg hover:bg-red-950/50 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-white/[0.04] w-8 h-8 rounded-lg flex items-center justify-center text-xl cursor-pointer border-0 transition-all"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        {!isNew && (
          <div className="shrink-0 flex border-b border-white/5 px-6">
            {(['details', 'comments'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-semibold capitalize border-b-2 transition-all cursor-pointer -mb-px ${
                  activeTab === tab
                    ? 'border-[#00f5ff] text-[#00f5ff]'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab} {tab === 'comments' ? `(${comments.length})` : ''}
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {(isNew || activeTab === 'details') && (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Status — only on Create */}
              {isNew ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Starting Column
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                  >
                    {(['Backlog', 'In Progress', 'Review', 'Done'] as TaskStatus[]).map((s) => (
                      <option key={s} value={s} className="bg-[#0d0925]">{s}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status:</span>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-[#00f5ff]/10 border border-[#00f5ff]/20 text-[#00f5ff]">
                    {task?.status}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">(drag the card to move)</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Title *
                </label>
                {canEdit ? (
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                    placeholder="Task title"
                  />
                ) : (
                  <p className="text-white font-semibold">{task?.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Description
                </label>
                {canEdit ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all resize-none"
                    placeholder="Optional description"
                  />
                ) : (
                  <p className="text-slate-300 text-sm">{task?.description || 'No description'}</p>
                )}
              </div>

              {/* Assignee */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Assignee
                  </label>
                  {canEdit ? (
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                    >
                      {assigneeOptions.map((name) => (
                        <option key={name} value={name} className="bg-[#0d0925]">{name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-300 text-sm">{task?.assignee || 'Unassigned'}</p>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Priority
                  </label>
                  {canEdit ? (
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TaskPriority)}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                    >
                      {(['low', 'med', 'high'] as TaskPriority[]).map((p) => (
                        <option key={p} value={p} className="bg-[#0d0925]">{p}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-slate-300 text-sm">{task?.priority}</p>
                  )}
                </div>
              </div>

              {/* Labels and Due Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Labels (comma-separated)
                  </label>
                  {canEdit ? (
                    <input
                      type="text"
                      value={labelsInput}
                      onChange={(e) => setLabelsInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                      placeholder="bug, frontend, api"
                    />
                  ) : (
                    <p className="text-slate-300 text-sm">{(task?.labels || []).join(', ') || 'None'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Due Date
                  </label>
                  {canEdit ? (
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all [color-scheme:dark]"
                    />
                  ) : (
                    <p className="text-slate-300 text-sm">
                      {task?.due_date ? formatFriendlyDate(task.due_date) : 'None'}
                    </p>
                  )}
                </div>
              </div>

              {/* Estimate hours */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Estimate (hours)
                </label>
                {canEdit ? (
                  <input
                    type="number"
                    min={0}
                    value={estimateHours}
                    onChange={(e) => setEstimateHours(parseInt(e.target.value, 10) || 0)}
                    className="w-40 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                  />
                ) : (
                  <p className="text-slate-300 text-sm">{task?.estimate_hours}h</p>
                )}
              </div>

              {canEdit && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#8a2be2] to-[#00f5ff] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? 'Saving...' : isNew ? 'Create Task' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Comments Tab */}
          {!isNew && activeTab === 'comments' && (
            <div className="p-6 flex flex-col gap-4">
              {loadingComments ? (
                <div className="text-slate-500 text-sm text-center py-4">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-slate-600 text-sm text-center py-6 border border-dashed border-white/5 rounded-xl">
                  No comments yet. Be the first to add one!
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8a2be2] to-[#00f5ff] text-[10px] font-bold text-white flex items-center justify-center uppercase shrink-0">
                        {((c.user as any)?.name || 'U')[0]}
                      </div>
                      <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-slate-200">
                            {(c.user as any)?.name || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment form */}
              <form onSubmit={handlePostComment} className="mt-2 flex gap-3">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#00f5ff] transition-all"
                />
                <button
                  type="submit"
                  disabled={postingComment || !commentText.trim()}
                  className="px-4 py-2.5 rounded-xl font-semibold text-white bg-[#8a2be2] hover:bg-[#7a23cc] transition-all disabled:opacity-40 cursor-pointer text-sm"
                >
                  {postingComment ? '...' : 'Post'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
