"use client";

import { SharedSourcePickerModal } from "../shared/source-picker-modal";
import { useDocumentsStore } from "@/stores/documents-store";

interface SourcePickerModalProps {
  open: boolean;
  onClose: () => void;
}

export function SourcePickerModal({ open, onClose }: SourcePickerModalProps) {
  const { addSources } = useDocumentsStore();
  return (
    <SharedSourcePickerModal
      open={open}
      onClose={onClose}
      onAddSources={addSources}
    />
  );
}
