"use client";
import { usePresentationsStore } from "@/stores/presentations-store";
import { SlideThumbnailList } from "./slide-thumbnail-list";
import { SlideLayoutEditor } from "./slide-layout-editor";

export function OutlineEditor() {
  const { getActiveSession } = usePresentationsStore();
  const session = getActiveSession();
  const selectedSlideId = session?.selectedSlideId;
  const selectedSlide = session?.outline.slides.find((s) => s.id === selectedSlideId);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thumbnail list — scrollable top section */}
      <div className="overflow-y-auto p-3 border-b border-cy-border" style={{ maxHeight: "45%" }}>
        <SlideThumbnailList />
      </div>

      {/* Block editor — bottom section */}
      <div className="flex-1 overflow-y-auto p-3">
        {selectedSlide ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-medium text-cy-muted">
                投影片 {(session?.outline.slides.findIndex((s) => s.id === selectedSlideId) ?? -1) + 1} 編輯
              </h3>
            </div>
            <SlideLayoutEditor slide={selectedSlide} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-cy-muted/60 italic">選擇投影片以編輯</p>
          </div>
        )}
      </div>
    </div>
  );
}
