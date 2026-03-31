// dashboard/src/lib/providers/registry.ts
import { DRIVE_ACCOUNTS, getAccount } from "@/config/accounts";
import { LocalDriveProvider } from "./local-drive";
import type { StorageProvider } from "./types";

const providers = new Map<string, StorageProvider>();

export function getStorageProvider(accountId: string): StorageProvider {
  let provider = providers.get(accountId);
  if (provider) return provider;

  const account = getAccount(accountId);
  if (!account) {
    throw new Error(`Unknown account: ${accountId}`);
  }

  provider = new LocalDriveProvider(account);
  providers.set(accountId, provider);
  return provider;
}

export function getAllAccountIds(): string[] {
  return DRIVE_ACCOUNTS.map((a) => a.id);
}
