import { homedir } from "os";
import { join } from "path";

const OBSIDIAN_ROOT = join(homedir(), "Obsidian-Cyclone");
const SPECIAL_ED = join(OBSIDIAN_ROOT, "02-特教業務");

export const OBSIDIAN_PATHS = {
  root: OBSIDIAN_ROOT,
  specialEd: SPECIAL_ED,
  spcMeeting: join(SPECIAL_ED, "特推會"),
  spcCommittee: join(SPECIAL_ED, "特推會", "委員名冊"),
  spcMoc: join(SPECIAL_ED, "特推會", "moc-特推會.md"),
  iep: join(SPECIAL_ED, "IEP"),
  iepTranscripts: join(SPECIAL_ED, "IEP", "逐字稿"),
  studentData: join(SPECIAL_ED, "學生資料"),
} as const;

export function committeeFilename(year: number): string {
  return `${year}-特推會委員名冊.md`;
}

export function committeePath(year: number): string {
  return join(OBSIDIAN_PATHS.spcCommittee, committeeFilename(year));
}

export function spcMeetingFilename(year: number, num: number, topic: string): string {
  const nn = String(num).padStart(2, "0");
  return `${year}-特推會-${nn}-${topic}.md`;
}

export function spcMeetingPath(year: number, num: number, topic: string): string {
  return join(OBSIDIAN_PATHS.spcMeeting, spcMeetingFilename(year, num, topic));
}
