import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { OBSIDIAN_PATHS, spcMeetingFilename } from "./obsidian-paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeetingStatus = "draft" | "agenda-generated" | "record-generated";
export type MeetingMode = "prep" | "record";

export interface SpcSessionMeta {
  type: string;
  academic_year: number;
  meeting_number: number;
  date: string;
  time_start: string;
  time_end?: string;
  location: string;
  chair: string;
  recorder: string;
  status: MeetingStatus;
  mode: MeetingMode;
  ref_files?: Array<{ path: string; scope: string }>;
  topics: string[];
  decisions: string[];
  tags: string[];
}

export interface SpcSessionData {
  meta: SpcSessionMeta;
  previousDecisions: string;
  businessReport: string;
  proposals: Array<{
    type: string;
    title: string;
    description: string;
    decision: string;
    students: Array<{
      name: string;
      className: string;
      disability: string;
      detail: string;
    }>;
    refDoc: string;
    refFiles?: Array<{ path: string; name: string }>;
  }>;
  motions: string;
}

export interface DraftInfo {
  filename: string;
  path: string;
  academicYear: number;
  meetingNumber: number;
  date: string;
  status: MeetingStatus;
  topics: string[];
}

// ---------------------------------------------------------------------------
// serializeSession — panel state → Markdown string
// ---------------------------------------------------------------------------

export function serializeSession(data: SpcSessionData): string {
  const { meta, previousDecisions, businessReport, proposals, motions } = data;

  // --- Build frontmatter ---
  const fm: string[] = ["---"];
  fm.push(`type: ${meta.type}`);
  fm.push(`academic_year: ${meta.academic_year}`);
  fm.push(`meeting_number: ${meta.meeting_number}`);
  fm.push(`date: "${meta.date}"`);
  fm.push(`time_start: "${meta.time_start}"`);
  if (meta.time_end) fm.push(`time_end: "${meta.time_end}"`);
  fm.push(`location: "${meta.location}"`);
  fm.push(`chair: "${meta.chair}"`);
  fm.push(`recorder: "${meta.recorder}"`);
  fm.push(`status: "${meta.status}"`);
  fm.push(`mode: "${meta.mode}"`);

  if (meta.ref_files && meta.ref_files.length > 0) {
    fm.push("ref_files:");
    for (const rf of meta.ref_files) {
      fm.push(`  - path: "${rf.path}"`);
      fm.push(`    scope: "${rf.scope}"`);
    }
  }

  // topics
  if (meta.topics.length > 0) {
    fm.push("topics:");
    for (const t of meta.topics) fm.push(`  - ${t}`);
  } else {
    fm.push("topics:");
  }

  // decisions
  if (meta.decisions.length > 0) {
    fm.push("decisions:");
    for (const d of meta.decisions) fm.push(`  - ${d}`);
  } else {
    fm.push("decisions:");
  }

  // tags
  const tagsStr = meta.tags.map((t) => t).join(", ");
  fm.push(`tags: [${tagsStr}]`);
  fm.push("---");

  // --- Build body ---
  const body: string[] = [];

  body.push(`# ${meta.academic_year}學年度 第${meta.meeting_number}次特推會`);
  body.push("");
  body.push(`- **日期**：${meta.date}`);
  body.push(`- **地點**：${meta.location}`);
  body.push(`- **主席**：${meta.chair}`);
  body.push(`- **記錄**：${meta.recorder}`);
  body.push(`- **狀態**：${meta.status}`);
  body.push("");
  body.push("---");
  body.push("");

  // Previous decisions
  body.push("## 前次會議決議追蹤");
  body.push("");
  body.push(previousDecisions.trim() || "（無）");
  body.push("");

  // Business report
  body.push("## 業務報告");
  body.push("");
  body.push(businessReport.trim() || "（無）");
  body.push("");

  // Proposals
  body.push("## 提案討論");
  body.push("");

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    const topicLabel = p.title || p.type || `案由${i + 1}`;
    body.push(`### 案由${i + 1}：${topicLabel}`);
    body.push("");

    if (p.students.length > 0) {
      body.push("**涉及學生：**");
      body.push("");
      body.push("| 姓名 | 班級 | 障別程度 | 備註 |");
      body.push("|------|------|---------|------|");
      for (const s of p.students) {
        body.push(`| ${s.name} | ${s.className} | ${s.disability} | ${s.detail} |`);
      }
      body.push("");
    }

    if (p.refDoc) {
      body.push(`**公文字號：** ${p.refDoc}`);
      body.push("");
    }

    if (p.refFiles && p.refFiles.length > 0) {
      body.push("**參考文件：**");
      body.push("");
      for (const rf of p.refFiles) {
        body.push(`- ${rf.name} (\`${rf.path}\`)`);
      }
      body.push("");
    }

    if (p.description) {
      body.push("**說明：**");
      body.push("");
      body.push(p.description.trim());
      body.push("");
    }

    body.push("**決議：**");
    body.push("");
    body.push(p.decision.trim() || "（待會議決定）");
    body.push("");
  }

  // Motions
  body.push("## 臨時動議");
  body.push("");
  body.push(motions.trim() || "無");
  body.push("");

  return fm.join("\n") + "\n\n" + body.join("\n");
}

// ---------------------------------------------------------------------------
// parseSession — Markdown string → panel state
// ---------------------------------------------------------------------------

export function parseSession(content: string): SpcSessionData | null {
  try {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const meta = parseFrontmatter(fmMatch[1]);
    const bodyStart = content.indexOf("\n---\n") + 5; // skip past closing ---
    const body = content.slice(bodyStart);

    // Section extraction helpers
    const previousDecisions = extractSection(body, "前次會議決議追蹤");
    const businessReport = extractSection(body, "業務報告");
    const motions = extractSection(body, "臨時動議");

    const proposals = extractProposals(body);

    return {
      meta,
      previousDecisions: cleanPlaceholder(previousDecisions),
      businessReport: cleanPlaceholder(businessReport),
      proposals,
      motions: cleanPlaceholder(motions),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// saveSessionToFile — write to Obsidian directory
// ---------------------------------------------------------------------------

export async function saveSessionToFile(data: SpcSessionData): Promise<string> {
  const { academic_year, meeting_number, topics } = data.meta;
  const topicStr = topics.length > 0 ? topics[0] : "草稿";
  const filename = spcMeetingFilename(academic_year, meeting_number, topicStr);
  const filePath = join(OBSIDIAN_PATHS.spcMeeting, filename);

  await mkdir(dirname(filePath), { recursive: true });

  const content = serializeSession(data);
  await writeFile(filePath, content, "utf-8");

  return filePath;
}

// ---------------------------------------------------------------------------
// findDraftSessions — find .md files with status != "record-generated"
// ---------------------------------------------------------------------------

export async function findDraftSessions(academicYear?: number): Promise<DraftInfo[]> {
  const dir = OBSIDIAN_PATHS.spcMeeting;
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const mdFiles = files
    .filter((f) => f.endsWith(".md") && !f.startsWith("moc-"))
    .sort()
    .reverse();

  const drafts: DraftInfo[] = [];

  for (const filename of mdFiles) {
    const content = await readFile(join(dir, filename), "utf-8").catch(() => null);
    if (!content) continue;

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;

    let meta: SpcSessionMeta;
    try {
      meta = parseFrontmatter(fmMatch[1]);
    } catch {
      continue;
    }

    if (meta.status === "record-generated") continue;
    if (academicYear !== undefined && meta.academic_year !== academicYear) continue;

    drafts.push({
      filename,
      path: join(dir, filename),
      academicYear: meta.academic_year,
      meetingNumber: meta.meeting_number,
      date: meta.date,
      status: meta.status,
      topics: meta.topics,
    });
  }

  return drafts;
}

// ---------------------------------------------------------------------------
// loadSessionFromFile — load and parse a specific .md
// ---------------------------------------------------------------------------

export async function loadSessionFromFile(filename: string): Promise<SpcSessionData | null> {
  const filePath = filename.startsWith("/")
    ? filename
    : join(OBSIDIAN_PATHS.spcMeeting, filename);

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  return parseSession(content);
}

// ---------------------------------------------------------------------------
// Internal: YAML frontmatter parser
// ---------------------------------------------------------------------------

function parseFrontmatter(yaml: string): SpcSessionMeta {
  const raw: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1 || line.startsWith(" ") || line.startsWith("-")) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    // Inline array: key: [a, b, c]
    if (rest.startsWith("[") && rest.endsWith("]")) {
      raw[key] = rest
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter((s) => s.length > 0);
      i++;
      continue;
    }

    // Value is present on the same line
    if (rest.length > 0) {
      const unquoted = rest.replace(/^["']|["']$/g, "");
      const num = Number(unquoted);
      raw[key] = !isNaN(num) && unquoted !== "" ? num : unquoted;
      i++;
      continue;
    }

    // No inline value — check for multi-line block
    const children: unknown[] = [];
    i++;
    while (i < lines.length) {
      const child = lines[i];
      // End of block: non-indented, non-dash line
      if (child.length > 0 && !child.startsWith(" ") && !child.startsWith("\t")) break;

      const trimmed = child.trim();
      if (!trimmed || trimmed === "") {
        i++;
        continue;
      }

      if (trimmed.startsWith("- ")) {
        // Could be a simple value or the start of an object block
        const itemVal = trimmed.slice(2).trim();
        if (itemVal.includes(":")) {
          // First line of object, e.g. `- path: "..."`
          const obj: Record<string, unknown> = parseInlinePair(itemVal);
          i++;
          // Consume further lines that belong to this object (indented deeper)
          while (i < lines.length) {
            const nextLine = lines[i];
            const nextTrimmed = nextLine.trim();
            if (!nextTrimmed || nextLine.startsWith("    ") || nextLine.startsWith("\t\t")) {
              if (nextTrimmed && !nextTrimmed.startsWith("- ")) {
                Object.assign(obj, parseInlinePair(nextTrimmed));
                i++;
              } else {
                break;
              }
            } else if (nextLine.startsWith("  ") && !nextTrimmed.startsWith("- ")) {
              Object.assign(obj, parseInlinePair(nextTrimmed));
              i++;
            } else {
              break;
            }
          }
          children.push(obj);
        } else {
          children.push(itemVal.replace(/^["']|["']$/g, ""));
          i++;
        }
      } else {
        // Possibly a key: value pair belonging to current object (shouldn't hit here in well-formed yaml)
        i++;
      }
    }

    raw[key] = children;
  }

  // Build typed meta with safe defaults
  const meta: SpcSessionMeta = {
    type: (raw["type"] as string) ?? "特推會會議",
    academic_year: (raw["academic_year"] as number) ?? 0,
    meeting_number: (raw["meeting_number"] as number) ?? 0,
    date: (raw["date"] as string) ?? "",
    time_start: (raw["time_start"] as string) ?? "",
    location: (raw["location"] as string) ?? "",
    chair: (raw["chair"] as string) ?? "",
    recorder: (raw["recorder"] as string) ?? "",
    status: ((raw["status"] as string) ?? "draft") as MeetingStatus,
    mode: ((raw["mode"] as string) ?? "record") as MeetingMode,
    topics: (raw["topics"] as string[]) ?? [],
    decisions: (raw["decisions"] as string[]) ?? [],
    tags: (raw["tags"] as string[]) ?? [],
  };

  if (raw["time_end"]) meta.time_end = raw["time_end"] as string;

  if (Array.isArray(raw["ref_files"]) && raw["ref_files"].length > 0) {
    meta.ref_files = (raw["ref_files"] as Array<Record<string, string>>).map((rf) => ({
      path: rf["path"] ?? "",
      scope: rf["scope"] ?? "",
    }));
  }

  return meta;
}

/** Parse a single `key: value` or `key: "value"` string into an object. */
function parseInlinePair(text: string): Record<string, string> {
  const colonIdx = text.indexOf(":");
  if (colonIdx === -1) return {};
  const key = text.slice(0, colonIdx).trim();
  const val = text.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
  return { [key]: val };
}

// ---------------------------------------------------------------------------
// Internal: body section extraction
// ---------------------------------------------------------------------------

/** Extract the text content of a ## heading section (up to the next ## heading). */
function extractSection(body: string, heading: string): string {
  const pattern = new RegExp(`## ${escapeRegex(heading)}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = body.match(pattern);
  if (!match) return "";
  return match[1].trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip placeholder values produced by serializeSession. */
function cleanPlaceholder(text: string): string {
  if (text === "（無）" || text === "無") return "";
  return text;
}

// ---------------------------------------------------------------------------
// Internal: proposal extraction
// ---------------------------------------------------------------------------

function extractProposals(body: string): SpcSessionData["proposals"] {
  const proposalSection = extractSection(body, "提案討論");
  if (!proposalSection) return [];

  // Split on ### 案由N： boundaries
  const blocks = proposalSection.split(/(?=###\s+案由\d+[：:])/).filter((b) => b.trim());
  const proposals: SpcSessionData["proposals"] = [];

  for (const block of blocks) {
    // Title line: ### 案由N：title
    const titleMatch = block.match(/###\s+案由\d+[：:](.+)/);
    const titleFull = titleMatch ? titleMatch[1].trim() : "";

    // Students table
    const students = extractStudentTable(block);

    // refDoc
    const refDocMatch = block.match(/\*\*公文字號[：:]\*\*\s*(.+)/);
    const refDoc = refDocMatch ? refDocMatch[1].trim() : "";

    // refFiles: lines matching `- name (\`path\`)`
    const refFiles = extractRefFiles(block);

    // Description: content under **說明：**
    const description = extractBoldSection(block, "說明");

    // Decision: content under **決議：**
    const decision = extractBoldSection(block, "決議");
    const cleanDecision = decision === "（待會議決定）" ? "" : decision;

    proposals.push({
      type: "",          // type is not stored in body; re-infer from meta.topics or leave empty
      title: titleFull,
      description,
      decision: cleanDecision,
      students,
      refDoc,
      refFiles: refFiles.length > 0 ? refFiles : undefined,
    });
  }

  return proposals;
}

function extractStudentTable(
  block: string
): Array<{ name: string; className: string; disability: string; detail: string }> {
  const students: Array<{ name: string; className: string; disability: string; detail: string }> =
    [];

  const tableMatch = block.match(/\|\s*姓名[\s\S]*?(?=\n\n|\n##|\n\*\*|$)/);
  if (!tableMatch) return students;

  const tableLines = tableMatch[0].split("\n").filter((l) => l.trim().startsWith("|"));
  // Skip header row and separator row
  for (const line of tableLines.slice(2)) {
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c !== "");
    if (cells.length >= 3) {
      students.push({
        name: cells[0] ?? "",
        className: cells[1] ?? "",
        disability: cells[2] ?? "",
        detail: cells[3] ?? "",
      });
    }
  }

  return students;
}

function extractRefFiles(block: string): Array<{ path: string; name: string }> {
  const refFiles: Array<{ path: string; name: string }> = [];

  // Match lines like: - filename.pdf (`~/path/to/file.pdf`)
  const pattern = /^-\s+(.+?)\s+\(`([^`]+)`\)/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) {
    refFiles.push({ name: match[1].trim(), path: match[2].trim() });
  }

  return refFiles;
}

/** Extract the paragraph(s) beneath a **heading：** bold label. */
function extractBoldSection(block: string, label: string): string {
  const pattern = new RegExp(
    `\\*\\*${escapeRegex(label)}[：:]\\*\\*\\n\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n###|$)`
  );
  const match = block.match(pattern);
  if (!match) return "";
  return match[1].trim();
}
