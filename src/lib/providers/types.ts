// dashboard/src/lib/providers/types.ts

export interface FileEntry {
  name: string;
  path: string; // relative to account base path
  isDirectory: boolean;
  size: number;
  modifiedAt: string; // ISO 8601
  mimeType?: string;
}

export interface StorageProvider {
  readonly id: string;
  readonly name: string;
  readonly accountEmail: string;

  listFiles(dirPath: string): Promise<FileEntry[]>;
  readFile(filePath: string, timeoutMs?: number): Promise<Buffer>;
  writeFile(filePath: string, content: Buffer): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;
  moveFile(src: string, dest: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  search(query: string, dirPath?: string): Promise<FileEntry[]>;
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
}
