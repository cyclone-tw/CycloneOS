"use client";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { usePresentationsStore } from "@/stores/presentations-store";
import type { SlideDefinition } from "@/stores/presentations-store";

function SortableSlide({ slide, index, isSelected }: { slide: SlideDefinition; index: number; isSelected: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: slide.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { setSelectedSlide } = usePresentationsStore();
  const title = slide.content.title ?? `投影片 ${index + 1}`;

  return (
    <div ref={setNodeRef} style={style} onClick={() => setSelectedSlide(slide.id)}
      className={`flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
        isSelected ? "bg-cy-accent/15 border border-cy-accent/30" : "bg-cy-input/30 border border-transparent hover:bg-cy-input/50"
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab text-cy-muted hover:text-cy-text">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-xs text-cy-muted w-5">{index + 1}</span>
      <span className="truncate text-cy-text">{title}</span>
    </div>
  );
}

export function SlideThumbnailList() {
  const { getActiveSession, reorderSlides, addSlide } = usePresentationsStore();
  const session = getActiveSession();
  const slides = session?.outline.slides ?? [];
  const selectedId = session?.selectedSlideId;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = slides.findIndex((s) => s.id === active.id);
      const newIndex = slides.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(slides.map((s) => s.id), oldIndex, newIndex);
      reorderSlides(newOrder);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-cy-muted">投影片</label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {slides.map((slide, i) => (
              <SortableSlide key={slide.id} slide={slide} index={i} isSelected={slide.id === selectedId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button onClick={() => addSlide("content")}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-cy-muted hover:text-cy-accent rounded-lg border border-dashed border-cy-border hover:border-cy-accent/30 transition-colors"
      >
        <Plus className="h-3 w-3" /> 新增投影片
      </button>
    </div>
  );
}
