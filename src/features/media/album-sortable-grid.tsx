"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { MediaTile } from "@/features/media/media-tile";
import type { SharedMediaItemDto } from "@/lib/media/client-api";
import { cn } from "@/lib/utils";

const GRID_CLASS = "grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-5 lg:gap-3";

function SortableTile({
  item,
  userId,
  label,
  subject,
  onOpen,
  onToggleFavorite,
  reordering,
}: {
  item: SharedMediaItemDto;
  userId: string;
  label: string;
  subject: string;
  onOpen: () => void;
  onToggleFavorite: () => void;
  reordering: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !reordering,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={cn("relative touch-manipulation", isDragging && "opacity-80")}
    >
      <MediaTile
        item={item}
        label={label}
        subject={subject}
        favorited={item.favoritedBy.includes(userId)}
        lovedByBoth={item.favoritedBy.length >= 2}
        onOpen={reordering ? undefined : onOpen}
        onToggleFavorite={reordering ? undefined : onToggleFavorite}
        className={cn(reordering && "pointer-events-none")}
      />
      {reordering ? (
        <button
          type="button"
          data-testid="album-drag-handle"
          data-media-id={item.id}
          // Keyboard: focus a handle, then Space to lift and arrows to move.
          aria-label={`Reorder ${subject}. Press space, then use arrow keys.`}
          className={cn(
            "absolute inset-0 grid cursor-grab place-items-center rounded-[1.15rem]",
            "bg-[color-mix(in_srgb,var(--shhh-viewer-ink)_26%,transparent)] text-[var(--shhh-viewer-ivory)] active:cursor-grabbing",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--shhh-accent-soft)]",
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5 drop-shadow-[0_1px_3px_rgb(0_0_0_/0.45)]" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

/**
 * Album photo grid with optional reordering. Drag is opt-in behind "Reorder"
 * so a normal tap always opens the viewer and can never start a drag by
 * accident on a touch screen.
 */
export function AlbumSortableGrid({
  items,
  userId,
  reordering,
  labelFor,
  subjectFor,
  onOpen,
  onToggleFavorite,
  onReorder,
}: {
  items: SharedMediaItemDto[];
  userId: string;
  reordering: boolean;
  labelFor: (item: SharedMediaItemDto) => string;
  subjectFor: (item: SharedMediaItemDto) => string;
  onOpen: (item: SharedMediaItemDto) => void;
  onToggleFavorite: (item: SharedMediaItemDto) => void;
  onReorder: (mediaIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Delay keeps vertical scrolling intact on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((item) => item.id));
  }

  const grid = (
    <ul className={GRID_CLASS} data-testid="album-grid">
      {items.map((item) => (
        <SortableTile
          key={item.id}
          item={item}
          userId={userId}
          reordering={reordering}
          label={labelFor(item)}
          subject={subjectFor(item)}
          onOpen={() => onOpen(item)}
          onToggleFavorite={() => onToggleFavorite(item)}
        />
      ))}
    </ul>
  );

  if (!reordering) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        {grid}
      </SortableContext>
    </DndContext>
  );
}
