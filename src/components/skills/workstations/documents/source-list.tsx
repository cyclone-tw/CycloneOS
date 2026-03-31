"use client";

import { SharedSourceList } from "../shared/source-list";
import { useDocumentsStore } from "@/stores/documents-store";

export function SourceList() {
  const { currentSession, addSources, removeSource } = useDocumentsStore();
  return (
    <SharedSourceList
      sources={currentSession?.sources ?? []}
      onAddSources={addSources}
      onRemoveSource={removeSource}
    />
  );
}
