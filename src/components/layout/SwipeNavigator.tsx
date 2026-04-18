// SwipeNavigator — горизонтальный свайп для:
//  • переключения между primary tabs (свайп влево/вправо в основной области)
//  • открытия бокового меню жестом от левого края
// Работает только на touch-устройствах. Игнорирует свайпы внутри скроллящихся областей и в DnD.
import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface Tab { to: string; end?: boolean }

interface Props {
  tabs: Tab[];
  currentPath: string;
  onOpenDrawer: () => void;
  children: ReactNode;
}

const EDGE_PX = 24;          // зона у левого края для открытия меню
const MIN_DIST = 60;         // минимальный путь по X для распознавания свайпа
const MAX_OFF_AXIS = 50;     // максимум по Y, чтобы не путать со скроллом
const MAX_DURATION = 600;    // мс

const matchTabIndex = (tabs: Tab[], path: string): number => {
  // Находим самый длинный совпадающий префикс
  let best = -1;
  let bestLen = -1;
  tabs.forEach((t, i) => {
    if (t.end ? path === t.to : path === t.to || path.startsWith(t.to + "/")) {
      if (t.to.length > bestLen) { best = i; bestLen = t.to.length; }
    }
  });
  return best;
};

export const SwipeNavigator = ({ tabs, currentPath, onOpenDrawer, children }: Props) => {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number; fromEdge: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { start.current = null; return; }
      const target = e.target as HTMLElement;
      // Не перехватываем на интерактивных / скроллящихся / чувствительных элементах
      if (
        target.closest("[data-no-swipe]") ||
        target.closest("input, textarea, select, [contenteditable='true'], canvas, svg, .recharts-wrapper, [role='slider'], [role='dialog']")
      ) { start.current = null; return; }
      const t = e.touches[0];
      start.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        fromEdge: t.clientX <= EDGE_PX,
      };
    };

    const onEnd = (e: TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      const dt = Date.now() - s.t;
      if (dt > MAX_DURATION) return;
      if (Math.abs(dy) > MAX_OFF_AXIS) return;
      if (Math.abs(dx) < MIN_DIST) return;

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
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, [tabs, currentPath, navigate, onOpenDrawer]);

  return <div ref={ref} className="contents">{children}</div>;
};
