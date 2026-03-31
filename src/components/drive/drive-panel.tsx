"use client";

import { AccountSwitcher } from "./account-switcher";
import { FileBrowser } from "./file-browser";
import { FilePreview } from "./file-preview";
import { useDriveStore } from "@/stores/drive-store";

export function DrivePanel() {
  const { selectedFile } = useDriveStore();

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-cy-text">Drive</h1>
        <AccountSwitcher />
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* File browser */}
        <div className={`min-h-0 overflow-auto ${selectedFile ? "w-1/2" : "w-full"}`}>
          <FileBrowser />
        </div>

        {/* Preview pane */}
        {selectedFile && (
          <div className="w-1/2 min-h-0 overflow-auto">
            <FilePreview />
          </div>
        )}
      </div>
    </div>
  );
}
