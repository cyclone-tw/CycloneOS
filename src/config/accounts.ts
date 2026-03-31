// dashboard/src/config/accounts.ts

export interface DriveAccount {
  id: string;
  email: string;
  label: string;
  localBasePath: string;
  outputFolder: string;
}

export const DRIVE_ACCOUNTS: DriveAccount[] = [
  {
    id: "personal",
    email: "user@gmail.com",
    label: "個人",
    localBasePath:
      "/Users/username/Library/CloudStorage/GoogleDrive-user@gmail.com/我的雲端硬碟",
    outputFolder: "CycloneOS-output",
  },
  {
    id: "school",
    email: "cyclonetw@ksps.ntct.edu.tw",
    label: "學校",
    localBasePath:
      "/Users/username/Library/CloudStorage/GoogleDrive-cyclonetw@ksps.ntct.edu.tw/我的雲端硬碟",
    outputFolder: "CycloneOS-output",
  },
];

export function getAccount(id: string): DriveAccount | undefined {
  return DRIVE_ACCOUNTS.find((a) => a.id === id);
}
