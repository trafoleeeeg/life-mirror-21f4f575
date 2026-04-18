// Тонкая обёртка для drag-and-drop одного блока на главной.
// Используется внутри DndContext + SortableContext в Mirror.tsx.
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { type ReactNode } from "react";

interface Props {
  id: string;
  children: ReactNode;
  /** disable drag handle (e.g. when DnD is off) */
  disabled?: boolean;
}

export const SortableSection = ({ id, children, disabled }: Props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      // нет data-no-swipe здесь — иначе горизонтальные свайпы между табами не работают
      // на главной. DnD активируется только через ручку (она ниже имеет data-no-swipe).
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        visibility: isDragging ? "hidden" : "visible",
      }}
      className="relative group"
    >
      {!disabled && (
        <button
          type="button"
          aria-label="Перетащить блок"
          data-no-swipe
          data-sortable-handle
          {...attributes}
          {...listeners}
          className="absolute -left-1 top-2 size-9 md:size-7 rounded-full bg-card border border-border
                     grid place-items-center md:opacity-0 md:group-hover:opacity-100
                     transition-opacity cursor-grab active:cursor-grabbing z-20 shadow-md
                     touch-none no-select"
        >
          <GripVertical className="size-4 md:size-3.5 text-muted-foreground" />
        </button>
      )}
      {children}
    </div>
  );
};
