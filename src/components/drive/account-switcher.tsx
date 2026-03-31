"use client";

import { useDriveStore } from "@/stores/drive-store";
import { DRIVE_ACCOUNTS } from "@/config/accounts";
import { cn } from "@/lib/utils";

export function AccountSwitcher() {
  const { activeAccount, setActiveAccount } = useDriveStore();

  return (
    <div className="flex gap-1 rounded-lg bg-cy-card p-1">
      {DRIVE_ACCOUNTS.map((account) => (
        <button
          key={account.id}
          onClick={() => setActiveAccount(account.id)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            activeAccount === account.id
              ? "bg-cy-accent/20 text-cy-accent"
              : "text-cy-muted hover:text-cy-text"
          )}
        >
          {account.label}
        </button>
      ))}
    </div>
  );
}
