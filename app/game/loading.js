/**
 * Counts the model files in flight, so the title screen can show the herd arriving instead of
 * a run starting with stand-ins. Loaders call `track(promise)`; the UI listens with `onLoading`.
 */
let total = 0;
let done = 0;
const listeners = new Set();

export function track(promise) {
  total++;
  notify();
  promise.finally(() => {
    done++;
    notify();
  });
  return promise;
}

export function loadingState() {
  return { done, total, ready: done >= total };
}

export function onLoading(fn) {
  listeners.add(fn);
  fn(loadingState());
  return () => listeners.delete(fn);
}

function notify() {
  const s = loadingState();
  listeners.forEach((fn) => fn(s));
}
