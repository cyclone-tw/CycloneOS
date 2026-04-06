// src/components/skills/workstations/social/image-uploader.tsx
"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { useSocialStore } from "@/stores/social-store";

export function ImageUploader() {
  const { images, addImages, removeImage } = useSocialStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length > 0) {
      addImages(imageFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-cy-border bg-cy-input px-4 py-6 cursor-pointer hover:border-cy-accent hover:bg-cy-card/50 transition-colors select-none"
      >
        <ImagePlus className="h-6 w-6 text-cy-muted" />
        <p className="text-sm text-cy-muted">拖曳或點擊上傳圖片</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          // Reset so same file can be re-selected
          e.target.value = "";
        }}
      />

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt="preview"
                className="h-16 w-16 rounded-lg border border-cy-border object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(img.id);
                }}
                className="absolute -right-1.5 -top-1.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-cy-error text-white shadow-sm hover:opacity-90 transition-opacity"
                title="移除"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
