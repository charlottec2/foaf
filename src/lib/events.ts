// Lightweight in-memory event bus for "network expansion" cues.
// Rendered by UnlockBanner once per new connection event.
type Listener = (payload: { name: string }) => void;
const listeners = new Set<Listener>();

export const emitNetworkExpansion = (payload: { name: string }) => {
  listeners.forEach((l) => l(payload));
};

export const onNetworkExpansion = (l: Listener) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
