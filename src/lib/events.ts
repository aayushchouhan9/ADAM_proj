type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Subscribes a listener callback to change notifications.
 * Returns an unsubscribe function.
 */
export function subscribeChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Triggers all active subscribers that a change has occurred.
 */
export function notifyChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error notifying change listener:', err);
    }
  });
}
