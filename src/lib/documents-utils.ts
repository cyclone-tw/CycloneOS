// Shared utilities for Documents workstation
// Used by both API routes and frontend components

/**
 * Strip Claude output artifacts:
 * 1. CLAUDE.md context indicator (📊 Context: ~XX%)
 * 2. Markdown fences wrapping the entire content
 */
export function cleanClaudeOutput(text: string): string {
  let cleaned = text.replace(/\n*---\n📊 Context:[\s\S]*$/, "").trimEnd();
  cleaned = cleaned.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/, "$1").trimEnd();
  return cleaned;
}

/**
 * Escape literal control characters inside JSON string values.
 * Claude sometimes outputs literal newlines instead of \\n in JSON strings,
 * which causes JSON.parse to fail with "Bad control character in string literal".
 * Uses a state machine to only escape inside string values, not between tokens.
 */
/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * When Claude hits its max output tokens, the JSON is cut off mid-value.
 * This function tries to make it parseable by closing open structures.
 * Returns the repaired text, or the original if repair isn't needed.
 */
export function repairTruncatedJson(text: string): string {
  try {
    JSON.parse(text);
    return text; // Already valid
  } catch {
    // Not valid — try to repair
  }

  let repaired = text;

  // Track whether we're inside a string and the delimiter stack
  let inStr = false;
  let esc = false;
  const stack: string[] = []; // tracks open delimiters in order

  for (const ch of repaired) {
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // If truncated inside a string, close the string first
  if (inStr) {
    // Remove the incomplete string value from the truncation point
    // Find the last unescaped quote (start of the truncated string)
    const lastQuote = repaired.lastIndexOf('"');
    if (lastQuote >= 0) {
      // Check if this quote was a key or value by looking at what precedes it
      const beforeQuote = repaired.slice(0, lastQuote).trimEnd();
      if (beforeQuote.endsWith(":")) {
        // Truncated string value — close with empty string
        repaired = repaired.slice(0, lastQuote) + '""';
      } else if (beforeQuote.endsWith(",") || beforeQuote.endsWith("[")) {
        // Truncated string that's an array element or new key — remove it
        repaired = beforeQuote;
      } else {
        // Just close the string
        repaired += '"';
      }
    } else {
      repaired += '"';
    }

    // Recount the stack after modification
    stack.length = 0;
    inStr = false;
    esc = false;
    for (const ch of repaired) {
      if (esc) { esc = false; continue; }
      if (ch === "\\" && inStr) { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") stack.push("}");
      else if (ch === "[") stack.push("]");
      else if (ch === "}" || ch === "]") stack.pop();
    }
  }

  // Remove trailing comma (invalid before closing delimiter)
  repaired = repaired.replace(/,\s*$/, "");

  // Close open delimiters in reverse order (LIFO)
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return text; // Repair didn't help
  }
}

export function fixJsonControlChars(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\" && inString) {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        // Control character inside string — escape it
        if (code === 0x0a) { result += "\\n"; continue; }
        if (code === 0x0d) { result += "\\r"; continue; }
        if (code === 0x09) { result += "\\t"; continue; }
        result += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }

    result += ch;
  }

  return result;
}
