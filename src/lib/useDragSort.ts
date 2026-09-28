import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

type Rect = { top: number; height: number };
type DragState = { id: string; from: number; target: number; dy: number; dropping: boolean };

const EDGE = 90; // px from the viewport edge where auto-scroll kicks in
const BOTTOM_EDGE = 130; // larger at the bottom to clear the mobile tab bar
const MAX_SPEED = 16;
const DROP_MS = 180;

/**
 * Fluid drag-to-reorder without extra dependencies.
 * - Drag starts from a handle (so the rest of the row keeps scrolling normally on touch).
 * - The dragged row follows the pointer; the others slide out of the way.
 * - Auto-scrolls the page near the top/bottom edge.
 * - ArrowUp/ArrowDown on the focused handle move one position (keyboard access).
 */
export function useDragSort(ids: string[], onCommit: (nextIds: string[]) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const idsRef = useRef(ids);
  idsRef.current = ids;
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  const els = useRef(new Map<string, HTMLElement>());
  const session = useRef<{
    id: string; from: number; target: number; startY: number; startScroll: number;
    lastY: number; rects: Rect[]; raf: number; handle: HTMLElement; pointerId: number;
  } | null>(null);

  const register = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el); else els.current.delete(id);
  }, []);

  const computeTarget = (s: NonNullable<typeof session.current>, dy: number) => {
    const draggedCenter = s.rects[s.from].top + s.rects[s.from].height / 2 + dy;
    let target = s.from;
    s.rects.forEach((r, j) => {
      if (j === s.from) return;
      const center = r.top + r.height / 2;
      if (j > s.from && draggedCenter > center) target = Math.max(target, j);
      if (j < s.from && draggedCenter < center) target = Math.min(target, j);
    });
    return target;
  };

  const update = () => {
    const s = session.current;
    if (!s) return;
    const dy = s.lastY - s.startY + (window.scrollY - s.startScroll);
    s.target = computeTarget(s, dy);
    setDrag({ id: s.id, from: s.from, target: s.target, dy, dropping: false });
  };

  const tick = () => {
    const s = session.current;
    if (!s) return;
    let speed = 0;
    if (s.lastY < EDGE) speed = -MAX_SPEED * ((EDGE - s.lastY) / EDGE);
    else if (s.lastY > window.innerHeight - BOTTOM_EDGE) {
      speed = MAX_SPEED * ((s.lastY - (window.innerHeight - BOTTOM_EDGE)) / BOTTOM_EDGE);
    }
    if (speed !== 0) {
      window.scrollBy(0, speed);
      update();
    }
    s.raf = requestAnimationFrame(tick);
  };

  const finish = (cancelled: boolean) => {
    const s = session.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    try { s.handle.releasePointerCapture(s.pointerId); } catch { /* already released */ }

    const from = s.from;
    const target = cancelled ? from : s.target;
    const draggedH = s.rects[from].height;
    // where the dragged row should settle, relative to where it started
    let finalDy = 0;
    if (target > from) finalDy = s.rects[target].top + s.rects[target].height - draggedH - s.rects[from].top;
    else if (target < from) finalDy = s.rects[target].top - s.rects[from].top;

    session.current = null;
    setDrag({ id: s.id, from, target, dy: finalDy, dropping: true });

    window.setTimeout(() => {
      document.body.style.userSelect = "";
      if (target !== from) {
        const next = [...idsRef.current];
        const [moved] = next.splice(from, 1);
        next.splice(target, 0, moved);
        commitRef.current(next);
      }
      setDrag(null);
    }, DROP_MS);
  };

  useEffect(() => () => {
    if (session.current) cancelAnimationFrame(session.current.raf);
    document.body.style.userSelect = "";
  }, []);

  const startDrag = (id: string, e: ReactPointerEvent<HTMLElement>) => {
    if (session.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    const list = idsRef.current;
    const from = list.indexOf(id);
    if (from < 0) return;
    const rects: Rect[] = [];
    for (const i of list) {
      const el = els.current.get(i);
      if (!el) return;
      const r = el.getBoundingClientRect();
      rects.push({ top: r.top + window.scrollY, height: r.height });
    }
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    if (navigator.vibrate) navigator.vibrate(8);
    session.current = {
      id, from, target: from, startY: e.clientY, startScroll: window.scrollY,
      lastY: e.clientY, rects, raf: 0, handle, pointerId: e.pointerId,
    };
    session.current.raf = requestAnimationFrame(tick);
    setDrag({ id, from, target: from, dy: 0, dropping: false });
  };

  const moveDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const s = session.current;
    if (!s || e.pointerId !== s.pointerId) return;
    s.lastY = e.clientY;
    update();
  };

  const getHandleProps = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => startDrag(id, e),
    onPointerMove: moveDrag,
    onPointerUp: () => finish(false),
    onPointerCancel: () => finish(true),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const list = idsRef.current;
      const from = list.indexOf(id);
      const to = from + (e.key === "ArrowUp" ? -1 : 1);
      if (from < 0 || to < 0 || to >= list.length) return;
      const next = [...list];
      [next[from], next[to]] = [next[to], next[from]];
      commitRef.current(next);
    },
    style: { touchAction: "none" } as CSSProperties,
  });

  const getItemProps = (id: string) => {
    const index = idsRef.current.indexOf(id);
    const base = { ref: register(id) };
    if (!drag || index < 0) return { ...base, style: undefined as CSSProperties | undefined, dragging: false };

    const s = session.current;
    const rects = s?.rects;
    const draggedH = rects ? rects[drag.from]?.height ?? 0 : 0;
    const gapGuess = 8;

    if (id === drag.id) {
      return {
        ...base,
        dragging: true,
        style: {
          transform: `translateY(${drag.dy}px)`,
          transition: drag.dropping ? `transform ${DROP_MS}ms ease-out` : "none",
          position: "relative",
          zIndex: 30,
        } as CSSProperties,
      };
    }

    let shift = 0;
    if (drag.from < drag.target && index > drag.from && index <= drag.target) shift = -(draggedH + gapGuess);
    if (drag.from > drag.target && index >= drag.target && index < drag.from) shift = draggedH + gapGuess;
    return {
      ...base,
      dragging: false,
      style: {
        transform: shift ? `translateY(${shift}px)` : undefined,
        transition: `transform ${DROP_MS}ms ease-out`,
      } as CSSProperties,
    };
  };

  return { getItemProps, getHandleProps, activeId: drag?.id ?? null };
}
