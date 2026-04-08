/**
 * pii-mask.ts — PII 遮蔽工具，供特推會文件產出使用
 *
 * Obsidian .md 保留原始姓名，分發文件（.docx / .html）透過此模組遮蔽。
 */

// ── 姓名遮蔽 ──

/**
 * 遮蔽中文姓名中間字元，以 ○ 取代。
 *
 * - 1 字：原樣返回
 * - 2 字：王明 → 王○
 * - 3 字：王大明 → 王○明
 * - 4+ 字：歐陽佩琪 → 歐○○琪（保留首尾，中間全遮）
 */
export function maskName(name: string): string {
  const len = name.length;
  if (len <= 1) return name;
  if (len === 2) return name[0] + "○";
  // 3+ chars: keep first and last, replace middle with ○
  const middle = "○".repeat(len - 2);
  return name[0] + middle + name[len - 1];
}

// ── 地址與電話正規式 ──

/** 臺灣地址：縣/市 + 鄉/鎮/市/區 + 後續詳細地址 */
const ADDRESS_RE =
  /[\u4e00-\u9fa5]{2,6}[縣市][\u4e00-\u9fa5]{2,6}[鄉鎮市區][\u4e00-\u9fa5\d\-號樓巷弄路街段之 　，,#\.\-（）()]+/g;

/** 手機：09xx-xxx-xxx 或 09xxxxxxxx（含常見分隔符號）*/
const MOBILE_RE = /09\d{2}[-.\s]?\d{3}[-.\s]?\d{3}/g;

/** 市話：0x-xxxx-xxxx 或 0xx-xxx-xxxx 等格式 */
const LANDLINE_RE = /0[2-8]\d{0,1}[-.\s]?\d{3,4}[-.\s]?\d{4}/g;

// ── 全文 PII 遮蔽 ──

/**
 * 遮蔽文字中所有 PII：
 * 1. 已知姓名（依長度降序排序，避免短名截斷長名）
 * 2. 地址 → （地址已隱藏）
 * 3. 電話 → （電話已隱藏）
 */
export function maskPII(text: string, names: string[]): string {
  let result = text;

  // Sort longer names first to prevent partial-match issues
  const sorted = [...names].sort((a, b) => b.length - a.length);

  for (const name of sorted) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), maskName(name));
  }

  result = result.replace(ADDRESS_RE, "（地址已隱藏）");
  result = result.replace(MOBILE_RE, "（電話已隱藏）");
  result = result.replace(LANDLINE_RE, "（電話已隱藏）");

  return result;
}

// ── 從會議資料收集姓名 ──

interface Student {
  name: string;
  [key: string]: unknown;
}

interface Proposal {
  students?: Student[];
  [key: string]: unknown;
}

interface CommitteeMemberLike {
  name: string;
  [key: string]: unknown;
}

interface MeetingData {
  chair?: string;
  recorder?: string;
  committee?: CommitteeMemberLike[];
  proposals?: Proposal[];
  [key: string]: unknown;
}

/**
 * 從會議資料物件中收集所有人名，去重後返回。
 * 涵蓋主席、記錄、委員、各提案學生。
 */
export function collectNames(data: MeetingData): string[] {
  const set = new Set<string>();

  const add = (name: unknown) => {
    if (typeof name === "string" && name.trim()) {
      set.add(name.trim());
    }
  };

  add(data.chair);
  add(data.recorder);

  for (const member of data.committee ?? []) {
    add(member.name);
  }

  for (const proposal of data.proposals ?? []) {
    for (const student of proposal.students ?? []) {
      add(student.name);
    }
  }

  return Array.from(set);
}
