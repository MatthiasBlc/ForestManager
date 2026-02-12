type Listener = () => void;

const listeners = new Set<Listener>();

export const communityEvents = {
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  notify() {
    listeners.forEach((fn) => fn());
  },
};
