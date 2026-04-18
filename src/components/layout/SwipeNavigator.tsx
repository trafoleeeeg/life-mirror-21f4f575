// SwipeNavigator — горизонтальный свайп для:
//  • переключения между primary tabs (свайп влево/вправо)
//  • открытия бокового меню жестом от левого края экрана
// Слушает touch на window с capture=true — поэтому работает даже когда
// жест начинается внутри scrollable-контейнера (например лента, чат).
// Не мешает вертикальному скроллу: ничего не preventDefault'ит, а вертикальные
// движения сразу отменяют горизонтальный жест.
import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { haptic } from "@/lib/haptics";

interface Tab { to: string; end?: boolean }

interface Props {
  tabs: Tab[];
  currentPath: string;
  onOpenDrawer: () => void;
  children: ReactNode;
}

const EDGE_PX = 28;
const MIN_DIST = 55;
const MAX_DURATION = 700;
const RATIO = 1.4;
const MAX_VISUAL_OFFSET = 80;
const RESISTANCE = 0.45;

const matchTabIndex = (tabs: Tab[], path: string): number => {
  let best = -1;
  let bestLen = -1;
  tabs.forEach((t, i) => {
    if (t.end ? path === t.to : path === t.to || path.startsWith(t.to + "/")) {
      if (t.to.length > bestLen) { best = i; bestLen = t.to.length; }
    }
  });
  return best;
};

const SKIP_SELECTOR =
  "[data-no-swipe], input, textarea, select, [contenteditable='true'], " +
  "[role='slider'], [role='dialog'], [data-sortable-handle], " +
  ".recharts-wrapper, canvas";

export const SwipeNavigator = ({ tabs, currentPath, onOpenDrawer, children }: Props) => {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const start = useRef<
    | {
        x: number;
        y: number;
        t: number;
        fromEdge: boolean;
        cancelled: boolean;
        committed: boolean;
      }
    | null
  >(null);

  // Храним актуальные props в ref — чтобы listener'ы ставить один раз
  const stateRef = useRef({ tabs, currentPath, onOpenDrawer });
  stateRef.current = { tabs, currentPath, onOpenDrawer };

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const resetTransform = (animate: boolean) => {
      content.style.transition = animate ? "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none";
      content.style.transform = "translate3d(0,0,0)";
      if (animate) {
        const clear = () => {
          content.style.transition = "";
          content.removeEventListener("transitionend", clear);
        };
        content.addEventListener("transitionend", clear);
      }
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start.current = null; return; }
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(SKIP_SELECTOR)) { start.current = null; return; }
      if (document.body.classList.contains("dnd-dragging")) { start.current = null; return; }
      const t = e.touches[0];
      start.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        fromEdge: t.clientX <= EDGE_PX,
        cancelled: false,
        committed: false,
      };
    };

    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s || s.cancelled) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;

      if (!s.committed) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
        // Если вертикальное движение преобладает — отдаём управление скроллу
        if (Math.abs(dy) > Math.abs(dx) * 0.9) {
          s.cancelled = true;
          return;
        }
        s.committed = true;
      }

      // Edge-свайп: не сдвигаем контент (откроется drawer)
      if (s.fromEdge) return;

      const { tabs: tabsNow, currentPath: pathNow } = stateRef.current;
      const idx = matchTabIndex(tabsNow, pathNow);
      let offset = dx * RESISTANCE;
      const atStart = idx <= 0 && dx > 0;
      const atEnd = idx >= tabsNow.length - 1 && dx < 0;
      if (atStart || atEnd) offset *= 0.35;
      if (offset > MAX_VISUAL_OFFSET) offset = MAX_VISUAL_OFFSET;
      if (offset < -MAX_VISUAL_OFFSET) offset = -MAX_VISUAL_OFFSET;
      content.style.transition = "none";
      content.style.transform = `translate3d(${offset}px, 0, 0)`;
    };

    const onEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      resetTransform(true);
      if (!s || s.cancelled) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Date.now() - s.t;
      if (dt > MAX_DURATION) return;
      if (Math.abs(dx) < MIN_DIST) return;
      if (Math.abs(dx) < Math.abs(dy) * RATIO) return;

      const { tabs: tabsNow, currentPath: pathNow, onOpenDrawer: openNow } = stateRef.current;

      if (s.fromEdge && dx > 0) {
        void haptic("medium");
        openNow();
        return;
      }

      const idx = matchTabIndex(tabsNow, pathNow);
      if (idx < 0) return;
      if (dx < 0 && idx < tabsNow.length - 1) {
        void haptic("selection");
        navigate(tabsNow[idx + 1].to);
      } else if (dx > 0 && idx > 0) {
        void haptic("selection");
        navigate(tabsNow[idx - 1].to);
      }
    };

    // capture=true — ловим до scroll-контейнеров; passive — не блокируем скролл
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("touchstart", onStart, opts);
    window.addEventListener("touchmove", onMove, opts);
    window.addEventListener("touchend", onEnd, opts);
    window.addEventListener("touchcancel", onEnd, opts);
    return () => {
      window.removeEventListener("touchstart", onStart, opts);
      window.removeEventListener("touchmove", onMove, opts);
      window.removeEventListener("touchend", onEnd, opts);
      window.removeEventListener("touchcancel", onEnd, opts);
    };
  }, [navigate]);

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
      <div ref={contentRef} className="flex-1 min-w-0 will-change-transform flex flex-col">
        {children}
      </div>
    </div>
  );
};
