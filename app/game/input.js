/**
 * Swipe + keyboard input. Swipes fire as soon as the finger travels far enough,
 * not on release, which makes lane changes feel instant.
 */
/** Panels that scroll with a finger: full-screen sheets, the results card and every pop-up. */
export const SCROLLERS = '.sheet-body, .over .card, .modal, input, textarea';

export function bindInput(target, onAction) {
  let sx = 0;
  let sy = 0;
  let fired = false;
  let active = false;
  const THRESH = 24;

  const start = (x, y) => {
    sx = x;
    sy = y;
    fired = false;
    active = true;
  };
  const move = (x, y) => {
    if (!active || fired) return;
    const dx = x - sx;
    const dy = y - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESH) return;
    fired = true;
    if (Math.abs(dx) > Math.abs(dy)) onAction(dx > 0 ? 'right' : 'left');
    else onAction(dy > 0 ? 'down' : 'up');
  };
  const end = () => {
    active = false;
  };

  target.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });
  target.addEventListener('touchmove', (e) => {
    // anything that scrolls keeps its native drag; everywhere else a drag is a swipe
    if (e.target.closest?.(SCROLLERS)) return;
    const t = e.changedTouches[0];
    move(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  target.addEventListener('touchend', end, { passive: true });
  target.addEventListener('touchcancel', end, { passive: true });

  // mouse drag for desktop testing
  target.addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && start(e.clientX, e.clientY));
  window.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && move(e.clientX, e.clientY));
  window.addEventListener('pointerup', (e) => e.pointerType === 'mouse' && end());

  const keys = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down',
    Escape: 'pause', KeyP: 'pause',
  };
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    const a = keys[e.code];
    if (!a || e.repeat) return;
    e.preventDefault();
    onAction(a);
  });
}
