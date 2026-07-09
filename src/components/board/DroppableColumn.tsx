import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '@/lib/types';
import { SortableCard } from './SortableCard';

interface DroppableColumnProps {
  status: TaskStatus;
  tasks: Task[];
  columnStats: { count: number; totalHours: number; extraInfo: string };
  onCardClick: (task: Task) => void;
  isLocked: boolean;
  isMobileHidden: boolean;
}

export function DroppableColumn({
  status,
  tasks,
  columnStats,
  onCardClick,
  isLocked,
  isMobileHidden,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: isLocked, // Block drops into locked columns
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col bg-white/[0.01] border rounded-2xl p-4 min-h-[500px] transition-all ${
        isMobileHidden ? 'hidden md:flex' : 'flex'
      } ${
        isOver
          ? isLocked
            ? 'border-red-500/50 bg-red-950/10'
            : 'border-[#00f5ff]/40 bg-[#00f5ff]/5'
          : 'border-white/5'
      }`}
    >
      {/* Column Title and Stats */}
      <div className="shrink-0 flex items-center justify-between pb-3.5 border-b border-white/5 mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="font-bold text-base text-slate-200">{status}</h2>
          {isLocked && (
            <span
              className="text-xs text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20"
              title="Locked: Done column is restricted for members"
            >
              🔒 Locked
            </span>
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-bold text-slate-400">
            {columnStats.count} {columnStats.count === 1 ? 'task' : 'tasks'}
          </span>
          <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
            {columnStats.totalHours}h estimated{columnStats.extraInfo}
          </span>
        </div>
      </div>

      {/* Sortable Cards Container */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto pr-1">
          {tasks.map((task) => (
            <SortableCard
              key={task.id}
              task={task}
              onClick={() => onCardClick(task)}
              disabled={isLocked}
            />
          ))}

          {/* Empty state within column */}
          {tasks.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-white/5 rounded-xl text-center text-slate-600">
              <span className="text-xl mb-1.5">📂</span>
              <p className="text-xs font-semibold">No tasks in this column</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
