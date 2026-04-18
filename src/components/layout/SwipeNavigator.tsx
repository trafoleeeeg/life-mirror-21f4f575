// SwipeNavigator — горизонтальный свайп для:
//  • переключения между primary tabs (свайп влево/вправо в основной области)
//  • открытия бокового меню жестом от левого края экрана
// Визуальный feedback: контент следует за пальцем (как в iOS),
// тактильная отдача при срабатывании.
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
const RATIO = 1.6;
const MAX_VISUAL_OFFSET = 80; // максимальный сдвиг контента в пикселях
const RESISTANCE = 0.45;       // 0..1 — насколько туго идёт контент за пальцем

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
  "canvas, svg, .recharts-wrapper, [role='slider'], [role='dialog'], " +
  "[data-radix-scroll-area-viewport], [data-sortable-handle]";

export const SwipeNavigator = ({ tabs, currentPath, onOpenDrawer, children }: Props) => {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const start = useRef<
    | {
        x: number;
        y: number;
        t: number;
        fromEdge: boolean;
        cancelled: boolean;
        committed: boolean; // решили что это горизонтальный жест
      }
    | null
  >(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;

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
      const target = e.target as HTMLElement;
      if (target.closest(SKIP_SELECTOR)) { start.current = null; return; }
      // Если активен DnD (dnd-kit ставит класс на body) — не вмешиваемся
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
        // Решаем направление после первых 10px
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          s.cancelled = true;
          return;
        }
        s.committed = true;
      }

      // Если жест от края — не двигаем основной контент (откроется drawer на end)
      if (s.fromEdge) return;

      // Резистивный сдвиг — пользователь видит, что контент реагирует
      const idx = matchTabIndex(tabs, currentPath);
      let offset = dx * RESISTANCE;
      // Если на краю списка табов — добавляем дополнительное сопротивление (rubber band)
      const atStart = idx <= 0 && dx > 0;
      const atEnd = idx >= tabs.length - 1 && dx < 0;
      if (atStart || atEnd) offset *= 0.35;
      // Cap
      if (offset > MAX_VISUAL_OFFSET) offset = MAX_VISUAL_OFFSET;
      if (offset < -MAX_VISUAL_OFFSET) offset = -MAX_VISUAL_OFFSET;
      content.style.transition = "none";
      content.style.transform = `translate3d(${offset}px, 0, 0)`;
    };

    const onEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      // Всегда возвращаем контент на место
      resetTransform(true);
      if (!s || s.cancelled) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Date.now() - s.t;
      if (dt > MAX_DURATION) return;
      if (Math.abs(dx) < MIN_DIST) return;
      if (Math.abs(dx) < Math.abs(dy) * RATIO) return;

      if (s.fromEdge && dx > 0) {
        void haptic("medium");
        onOpenDrawer();
        return;
      }

      const idx = matchTabIndex(tabs, currentPath);
      if (idx < 0) return;
      if (dx < 0 && idx < tabs.length - 1) {
        void haptic("selection");
        navigate(tabs[idx + 1].to);
      } else if (dx > 0 && idx > 0) {
        void haptic("selection");
        navigate(tabs[idx - 1].to);
      }
    };

    wrap.addEventListener("touchstart", onStart, { passive: true });
    wrap.addEventListener("touchmove", onMove, { passive: true });
    wrap.addEventListener("touchend", onEnd, { passive: true });
    wrap.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      wrap.removeEventListener("touchstart", onStart);
      wrap.removeEventListener("touchmove", onMove);
      wrap.removeEventListener("touchend", onEnd);
      wrap.removeEventListener("touchcancel", onEnd);
    };
  }, [tabs, currentPath, navigate, onOpenDrawer]);

  return (
    <div ref={wrapRef} className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
      <div ref={contentRef} className="flex-1 min-w-0 will-change-transform flex flex-col">
        {children}
      </div>
    </div>
  );
};
