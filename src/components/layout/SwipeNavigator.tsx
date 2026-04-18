// SwipeNavigator — горизонтальный свайп для:
//  • переключения между primary tabs (свайп влево/вправо в основной области)
//  • открытия бокового меню жестом от левого края экрана
// Работает только на touch-устройствах. Игнорирует жесты на скроллящихся областях,
// в DnD, в формах, графиках и модалках.
import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Tab { to: string; end?: boolean }

interface Props {
  tabs: Tab[];
  currentPath: string;
  onOpenDrawer: () => void;
  children: ReactNode;
}

const EDGE_PX = 28;          // зона у левого края для открытия меню
const MIN_DIST = 55;         // минимальный путь по X для распознавания свайпа
const MAX_DURATION = 700;    // мс — больше времени на жест
const RATIO = 1.6;           // |dx| должно превышать |dy| хотя бы в 1.6 раза

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
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<
    | { x: number; y: number; t: number; fromEdge: boolean; cancelled: boolean }
    | null
  >(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start.current = null; return; }
      const target = e.target as HTMLElement;
      if (target.closest(SKIP_SELECTOR)) { start.current = null; return; }
      const t = e.touches[0];
      start.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        fromEdge: t.clientX <= EDGE_PX,
        cancelled: false,
      };
    };

    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s || s.cancelled) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      // Если очевидно вертикальный жест — отменяем (это скролл)
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        s.cancelled = true;
      }
    };

    const onEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.cancelled) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Date.now() - s.t;
      if (dt > MAX_DURATION) return;
      if (Math.abs(dx) < MIN_DIST) return;
      if (Math.abs(dx) < Math.abs(dy) * RATIO) return;

      // Свайп от левого края → открыть меню
      if (s.fromEdge && dx > 0) {
        onOpenDrawer();
        return;
      }

      // Переключение вкладок
      const idx = matchTabIndex(tabs, currentPath);
      if (idx < 0) return;
      if (dx < 0 && idx < tabs.length - 1) {
        navigate(tabs[idx + 1].to);
      } else if (dx > 0 && idx > 0) {
        navigate(tabs[idx - 1].to);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [tabs, currentPath, navigate, onOpenDrawer]);

  return <div ref={ref} className="contents">{children}</div>;
};
