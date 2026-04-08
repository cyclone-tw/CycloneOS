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

const PERSONAL_EMAIL = process.env.GOOGLE_DRIVE_EMAIL_PERSONAL || "user@gmail.com";
const SCHOOL_EMAIL = process.env.GOOGLE_DRIVE_EMAIL_SCHOOL || "user@school.edu.tw";

export const DRIVE_ACCOUNTS: DriveAccount[] = [
  {
    id: "personal",
    email: PERSONAL_EMAIL,
    label: "個人",
    localBasePath: driveBasePath(PERSONAL_EMAIL),
    outputFolder: "CycloneOS-output",
  },
  {
    id: "school",
    email: SCHOOL_EMAIL,
    label: "學校",
    localBasePath: driveBasePath(SCHOOL_EMAIL),
    outputFolder: "CycloneOS-output",
  },
];

export function getAccount(id: string): DriveAccount | undefined {
  return DRIVE_ACCOUNTS.find((a) => a.id === id);
}
