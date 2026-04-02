// dashboard/src/config/accounts.ts

import { homedir } from "os";
import { join } from "path";

export interface DriveAccount {
  id: string;
  email: string;
  label: string;
  localBasePath: string;
  outputFolder: string;
}

function driveBasePath(email: string): string {
  return join(homedir(), "Library/CloudStorage", `GoogleDrive-${email}`, "我的雲端硬碟");
}

export const DRIVE_ACCOUNTS: DriveAccount[] = [
  {
    id: "personal",
    email: "user@gmail.com",
    label: "個人",
    localBasePath: driveBasePath("user@gmail.com"),
    outputFolder: "CycloneOS-output",
  },
  {
    id: "school",
    email: "cyclonetw@ksps.ntct.edu.tw",
    label: "學校",
    localBasePath: driveBasePath("cyclonetw@ksps.ntct.edu.tw"),
    outputFolder: "CycloneOS-output",
  },
];

export function getAccount(id: string): DriveAccount | undefined {
  return DRIVE_ACCOUNTS.find((a) => a.id === id);
}
