// Полноэкранный просмотр картинки. Esc/клик — закрыть.
// Мобильные жесты: свайп вниз — закрыть, pinch — масштаб, drag при зуме — пан, double-tap — toggle zoom.
import { useEffect, useRef, useState, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  src: string;
  onClose: () => void;
}

type Pt = { id: number; x: number; y: number };

export const ImageLightbox = ({ src, onClose }: Props) => {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [dragY, setDragY] = useState(0); // свайп-вниз только при scale=1
  const [closing, setClosing] = useState(false);
  const pointers = useRef<Map<number, Pt>>(new Map());
  const gesture = useRef<{
    startDist?: number;
    startScale?: number;
    startTx?: number;
    startTy?: number;
    startMidX?: number;
    startMidY?: number;
    panStartX?: number;
    panStartY?: number;
    swipeStartY?: number;
    lastTap?: number;
  }>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onPointerDown = (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    const pts = Array.from(pointers.current.values());

    if (pts.length === 2) {
      const [a, b] = pts;
      const m = mid(a, b);
      gesture.current = {
        startDist: dist(a, b),
        startScale: scale,
        startTx: tx,
        startTy: ty,
        startMidX: m.x,
        startMidY: m.y,
      };
    } else if (pts.length === 1) {
      const now = Date.now();
      if (gesture.current.lastTap && now - gesture.current.lastTap < 280) {
        // double-tap toggle zoom
        if (scale > 1) { setScale(1); setTx(0); setTy(0); }
        else setScale(2.2);
        gesture.current.lastTap = 0;
      } else {
        gesture.current.lastTap = now;
      }
      gesture.current.panStartX = e.clientX;
      gesture.current.panStartY = e.clientY;
      gesture.current.startTx = tx;
      gesture.current.startTy = ty;
      gesture.current.swipeStartY = e.clientY;
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    const pts = Array.from(pointers.current.values());

    if (pts.length === 2 && gesture.current.startDist) {
      const [a, b] = pts;
      const d = dist(a, b);
      const next = Math.min(5, Math.max(1, (gesture.current.startScale || 1) * (d / gesture.current.startDist)));
      setScale(next);
      // pan по движению средней точки
      const m = mid(a, b);
      setTx((gesture.current.startTx || 0) + (m.x - (gesture.current.startMidX || 0)));
      setTy((gesture.current.startTy || 0) + (m.y - (gesture.current.startMidY || 0)));
    } else if (pts.length === 1) {
      const dx = e.clientX - (gesture.current.panStartX || 0);
      const dy = e.clientY - (gesture.current.panStartY || 0);
      if (scale > 1) {
        setTx((gesture.current.startTx || 0) + dx);
        setTy((gesture.current.startTy || 0) + dy);
      } else if (dy > 0) {
        // свайп вниз для закрытия
        setDragY(dy);
      }
    }
  };

  const finishPointer = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      if (scale <= 1) {
        if (dragY > 120) {
          setClosing(true);
          setTimeout(onClose, 160);
        } else {
          setDragY(0);
        }
      }
      gesture.current = { lastTap: gesture.current.lastTap };
    }
  };

  const opacity = Math.max(0.2, 1 - dragY / 600);
  const transform = `translate3d(${tx}px, ${ty + dragY}px, 0) scale(${scale})`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center select-none touch-none"
      style={{ background: `hsl(var(--background) / ${closing ? 0 : opacity})`, backdropFilter: "blur(12px)", transition: closing ? "background 160ms" : undefined }}
      onClick={(e) => { if (e.target === e.currentTarget && scale === 1 && dragY === 0) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 size-10 rounded-full bg-foreground/10 hover:bg-foreground/20 flex items-center justify-center transition-colors z-10"
        aria-label="Закрыть"
      >
        <X className="size-5" />
      </button>
      <img
        src={src}
        alt=""
        draggable={false}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        className="max-w-full max-h-full object-contain rounded-lg will-change-transform"
        style={{
          transform,
          transition: pointers.current.size === 0 && !closing ? "transform 200ms ease-out" : undefined,
          opacity: closing ? 0 : 1,
          touchAction: "none",
        }}
      />
    </div>,
    document.body,
  );
};
