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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 30 : "auto",
      }}
      className="relative group"
    >
      {!disabled && (
        <button
          type="button"
          aria-label="Перетащить"
          {...attributes}
          {...listeners}
          className="absolute -left-2 top-3 size-7 rounded-full bg-card border border-border
                     grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity
                     cursor-grab active:cursor-grabbing z-20 shadow-sm"
        >
          <GripVertical className="size-3.5 text-muted-foreground" />
        </button>
      )}
      {children}
    </div>
  );
};
