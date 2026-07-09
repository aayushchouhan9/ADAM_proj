import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/types';
import { formatFriendlyDate } from '@/lib/dates';

interface SortableCardProps {
  task: Task;
  onClick: () => void;
  disabled?: boolean;
}

export function SortableCard({ task, onClick, disabled }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isOverdue = () => {
    if (!task.due_date || task.status === 'Done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(task.due_date) < today;
  };

  const overdue = isOverdue();

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      {...attributes}
      {...listeners}
      className={`bg-[#0e0a25] hover:bg-[#120e2e] border border-white/5 rounded-xl p-4 transition-all hover:border-white/10 shadow-lg relative overflow-hidden select-none cursor-grab active:cursor-grabbing ${
        disabled ? 'opacity-80 !cursor-pointer' : ''
      }`}
    >
      {/* Warning Border indicator */}
      {task.has_warning && (
        <div className="absolute top-0 left-0 bottom-0 w-[3px] bg-amber-500" />
      )}

      {/* Card Header Title and Badges */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-bold text-sm text-slate-100 leading-tight">
          {task.title}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.has_warning && (
            <span className="text-amber-500 text-xs" title="Data repair warning">
              ⚠️
            </span>
          )}
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
              task.priority === 'high'
                ? 'bg-red-950/40 border border-red-900/60 text-red-300'
                : task.priority === 'med'
                ? 'bg-amber-950/40 border border-amber-900/60 text-amber-300'
                : 'bg-slate-800/40 border border-slate-700/60 text-slate-400'
            }`}
          >
            {task.priority}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-slate-400 text-xs line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.map((lbl) => (
            <span
              key={lbl}
              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/5"
            >
              {lbl}
            </span>
          ))}
        </div>
      )}

      {/* Card Footer Details */}
      {/* pointer-events-none ensures child elements don't block click/drag propagation */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1.5 pointer-events-none">
        {/* Assignee */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#8a2be2] to-[#00f5ff] text-[10px] font-bold text-white flex items-center justify-center uppercase select-none">
            {(task.assignee || 'U')[0]}
          </div>
          <span className="text-[11px] font-medium text-slate-300">
            {task.assignee || 'Unassigned'}
          </span>
        </div>

        {/* Estimate and Due Date */}
        <div className="flex items-center gap-3">
          {task.estimate_hours !== undefined && (
            <span className="text-[10px] font-bold text-slate-400 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded">
              {task.estimate_hours}h
            </span>
          )}
          {task.due_date && (
            <span
              className={`text-[10px] font-semibold ${
                overdue ? 'text-red-400 font-bold' : 'text-slate-400'
              }`}
            >
              📅 {formatFriendlyDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
