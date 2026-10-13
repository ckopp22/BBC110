// Shared tick engine for live elements (clock, timer, ...) and a registry of controllable elements.
// Displays are always computed from Date.now(), never counted, so they cannot drift when the tab is throttled.
const subs = new Set();
let timer = null;

function tick() {
  const now = Date.now();
  subs.forEach((fn) => fn(now));
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

export function subscribe(fn) {
  subs.add(fn);
  if (!timer) timer = setInterval(tick, 250);
  return () => {
    subs.delete(fn);
    if (!subs.size && timer) { clearInterval(timer); timer = null; }
  };
}

// Controllers let Show mode drive live elements: { type: 'timer' | 'score', ... }.
const controllers = new Set();
export function addController(c) { controllers.add(c); return () => controllers.delete(c); }
export const getControllers = (type) => [...controllers].filter((c) => c.type === type);
