'use client';

import { useEffect, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

/**
 * useLive(onChange) - Real-time board sync hook.
 *
 * Strategy priority:
 *  1. Supabase Realtime (if NEXT_PUBLIC_SUPABASE_* are set)
 *  2. SSE via /api/stream (single-instance local push)
 *  3. 5-second polling fallback
 *
 * Skips a refetch if dragging is in progress (isDragging ref passed in).
 */
export function useLive(onChange: () => void, isDragging: React.MutableRefObject<boolean>) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    const fire = () => {
      if (!isDragging.current) {
        callbackRef.current();
      }
    };

    // 1. Supabase Realtime
    if (supabaseBrowser) {
      const channel = supabaseBrowser
        .channel(`board-changes-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fire)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, fire)
        .subscribe();

      return () => {
        supabaseBrowser!.removeChannel(channel);
      };
    }

    // 2. SSE fallback
    let eventSource: EventSource | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    try {
      eventSource = new EventSource('/api/stream');
      eventSource.onmessage = (e) => {
        if (e.data === 'change') fire();
      };
      eventSource.onerror = () => {
        // SSE failed — fall back to polling
        eventSource?.close();
        eventSource = null;
        pollingTimer = setInterval(fire, 5000);
      };
    } catch {
      // SSE not supported — use polling
      pollingTimer = setInterval(fire, 5000);
    }

    return () => {
      eventSource?.close();
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
