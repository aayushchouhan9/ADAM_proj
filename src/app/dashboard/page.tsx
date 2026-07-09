'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  Backlog: '#6366f1',
  'In Progress': '#f59e0b',
  Review: '#8b5cf6',
  Done: '#10b981',
};

interface ActivityEntry {
  id: string;
  action: string;
  from_status?: string;
  to_status?: string;
  created_at: string;
  user?: { name: string };
  task?: { title: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [stats, setStats] = useState<{
    byStatus: Record<string, number>;
    hoursByAssignee: Record<string, number>;
    completedThisWeek: number;
    totalTasks: number;
  } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/users/me').then((r) => r.json()),
      fetch('/api/stats').then((r) => r.json()),
      fetch('/api/activity?limit=30').then((r) => r.json()),
    ])
      .then(([userRes, statsRes, actRes]) => {
        if (!userRes.ok) { router.push('/login'); return; }
        setUser(userRes.data);
        if (statsRes.ok) setStats(statsRes.data);
        if (actRes.ok) setActivity(actRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  const statusData = stats
    ? Object.entries(stats.byStatus).map(([name, value]) => ({ name, value }))
    : [];

  const hoursData = stats
    ? Object.entries(stats.hoursByAssignee)
        .map(([name, hours]) => ({ name, hours }))
        .sort((a, b) => b.hours - a.hours)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060312]">
        <div className="w-12 h-12 rounded-full border-4 border-[#00f5ff]/20 border-t-[#00f5ff] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060312] text-white font-sans">
      {/* Header */}
      <header className="bg-[#0a051b]/90 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <a href="/board" className="text-2xl font-black bg-gradient-to-r from-[#00f5ff] to-[#8a2be2] bg-clip-text text-transparent">
            Sprintly
          </a>
          <span className="text-slate-400">/ Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">{user.name}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#00f5ff]">{user.role}</span>
            </div>
          )}
          <a href="/board"
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/5 transition-all">
            ← Board
          </a>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { label: 'Total Tasks', value: stats?.totalTasks || 0, color: 'from-[#6366f1] to-[#8a2be2]' },
            { label: 'In Progress', value: stats?.byStatus['In Progress'] || 0, color: 'from-[#f59e0b] to-[#ef4444]' },
            { label: 'Review', value: stats?.byStatus['Review'] || 0, color: 'from-[#8b5cf6] to-[#6366f1]' },
            { label: 'Completed This Week', value: `${stats?.completedThisWeek || 0}h`, color: 'from-[#10b981] to-[#06b6d4]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
              <div className={`text-3xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent mb-1`}>
                {value}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tasks by Status — Pie Chart */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="font-bold text-slate-200 mb-5">Tasks by Status</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6366f1'} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span className="text-xs text-slate-300">{v}</span>} />
                  <Tooltip contentStyle={{ background: '#0d0925', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-slate-600 text-sm">No data yet</div>
            )}
          </div>

          {/* Hours per Assignee — Bar Chart */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
            <h3 className="font-bold text-slate-200 mb-5">Hours per Assignee</h3>
            {hoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hoursData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0d0925', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {hoursData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${240 + i * 30}, 70%, 65%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-slate-600 text-sm">No data yet</div>
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-slate-200 mb-5">Recent Activity</h3>
          {activity.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-8 border border-dashed border-white/5 rounded-xl">
              No activity yet. Import data or make some moves to see activity here.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#8a2be2] to-[#00f5ff] text-[10px] font-bold text-white flex items-center justify-center uppercase shrink-0">
                    {(entry.user?.name || 'S')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200">
                      <span className="font-bold">{entry.user?.name || 'System'}</span>
                      {' '}
                      <span className="text-slate-400">{formatAction(entry)}</span>
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${actionBadgeColor(entry.action)}`}>
                    {entry.action}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function formatAction(entry: ActivityEntry): string {
  const task = entry.task?.title ? `"${entry.task.title}"` : 'a task';
  switch (entry.action) {
    case 'created': return `created ${task}`;
    case 'moved': return `moved ${task} from ${entry.from_status} → ${entry.to_status}`;
    case 'completed': return `completed ${task}`;
    case 'reordered': return `reordered ${task} in ${entry.to_status}`;
    case 'assigned': return `assigned ${task} to ${entry.to_status}`;
    case 'unassigned': return `unassigned ${entry.from_status} from ${task}`;
    case 'deleted': return `deleted a task`;
    case 'imported': return `imported board data (${entry.from_status} issues fixed · ${entry.to_status} tasks loaded)`;
    case 'reset': return `reset the board`;
    default: return entry.action;
  }
}

function actionBadgeColor(action: string): string {
  const map: Record<string, string> = {
    created: 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/30',
    moved: 'bg-blue-950/40 text-blue-300 border border-blue-800/30',
    completed: 'bg-teal-950/40 text-teal-300 border border-teal-800/30',
    reordered: 'bg-slate-900/40 text-slate-400 border border-slate-700/30',
    assigned: 'bg-purple-950/40 text-purple-300 border border-purple-800/30',
    unassigned: 'bg-amber-950/40 text-amber-300 border border-amber-800/30',
    deleted: 'bg-red-950/40 text-red-300 border border-red-800/30',
    imported: 'bg-cyan-950/40 text-cyan-300 border border-cyan-800/30',
    reset: 'bg-pink-950/40 text-pink-300 border border-pink-800/30',
  };
  return map[action] || 'bg-slate-900/40 text-slate-400';
}
