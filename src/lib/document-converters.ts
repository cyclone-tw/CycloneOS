// src/lib/document-converters.ts
//
// Markdown → DOCX / PDF / XLSX converters for Documents workstation.

import { Marked } from "marked";

const marked = new Marked();

/**
 * Convert markdown to DOCX buffer.
 * Uses html-to-docx: markdown → HTML → DOCX
 */
export async function markdownToDocx(markdown: string): Promise<Buffer> {
  const html = await marked.parse(markdown);

  // html-to-docx is a CJS module, use dynamic import
  const htmlToDocx = (await import("html-to-docx")).default;

  const styledHtml = `
    <html>
    <head><style>
      body { font-family: "Microsoft JhengHei", "PingFang TC", sans-serif; font-size: 12pt; line-height: 1.6; }
      h1 { font-size: 22pt; margin-top: 16pt; margin-bottom: 8pt; }
      h2 { font-size: 18pt; margin-top: 14pt; margin-bottom: 6pt; }
      h3 { font-size: 14pt; margin-top: 12pt; margin-bottom: 4pt; }
      table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
      th, td { border: 1px solid #999; padding: 6pt 8pt; text-align: left; }
      th { background-color: #f0f0f0; font-weight: bold; }
      code { font-family: "Courier New", monospace; background-color: #f5f5f5; padding: 1pt 3pt; }
      pre { background-color: #f5f5f5; padding: 8pt; border-radius: 4pt; overflow-x: auto; }
      blockquote { border-left: 3pt solid #ccc; margin-left: 0; padding-left: 12pt; color: #555; }
    </style></head>
    <body>${html}</body>
    </html>
  `;

  const docxBuffer = await htmlToDocx(styledHtml, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });

  return Buffer.from(docxBuffer);
}

/**
 * Convert markdown to PDF buffer.
 * Generates a self-contained HTML with print-friendly CSS,
 * saved as HTML that can be opened and printed to PDF.
 * (True PDF generation would require puppeteer which is too heavy.)
 */
export async function markdownToPdfHtml(markdown: string, title?: string): Promise<string> {
  const html = await marked.parse(markdown);

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<title>${title || "文件"}</title>
<style>
  @page { margin: 2cm; size: A4; }
  body {
    font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif;
    font-size: 12pt;
    line-height: 1.8;
    color: #222;
    max-width: 800px;
    margin: 0 auto;
    padding: 2cm;
  }
  h1 { font-size: 22pt; margin-top: 24pt; margin-bottom: 12pt; border-bottom: 1px solid #ccc; padding-bottom: 6pt; }
  h2 { font-size: 18pt; margin-top: 20pt; margin-bottom: 8pt; }
  h3 { font-size: 14pt; margin-top: 16pt; margin-bottom: 6pt; }
  p { margin: 8pt 0; }
  ul, ol { margin: 8pt 0; padding-left: 24pt; }
  li { margin: 4pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
  th, td { border: 1px solid #999; padding: 6pt 10pt; text-align: left; }
  th { background-color: #f0f0f0; font-weight: bold; }
  code { font-family: "Courier New", "Noto Sans Mono", monospace; background-color: #f5f5f5; padding: 1pt 4pt; border-radius: 2pt; font-size: 10pt; }
  pre { background-color: #f5f5f5; padding: 12pt; border-radius: 4pt; overflow-x: auto; font-size: 10pt; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3pt solid #ccc; margin: 8pt 0; padding-left: 16pt; color: #555; }
  img { max-width: 100%; }
  @media print {
    body { padding: 0; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
  }
</style>
</head>
<body>
${html}
<script>
// Auto-trigger print dialog when opened
if (window.location.protocol === 'file:') {
  window.onload = () => window.print();
}
</script>
</body>
</html>`;
}

/**
 * Convert markdown to XLSX buffer.
 * Extracts tables from markdown; if no tables, puts the full text in a sheet.
 */
export async function markdownToXlsx(markdown: string): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  // Try to extract markdown tables
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)*)/g;
  let match;
  let sheetIndex = 0;

  while ((match = tableRegex.exec(markdown)) !== null) {
    sheetIndex++;
    const headerLine = match[1];
    const bodyLines = match[2].trim().split("\n");

    const headers = headerLine.split("|").map(h => h.trim()).filter(Boolean);
    const sheet = workbook.addWorksheet(`表格 ${sheetIndex}`);

    // Header row with styling
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Data rows
    for (const line of bodyLines) {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      sheet.addRow(cells);
    }

    // Auto-fit column widths
    sheet.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, cell => {
        const len = String(cell.value || "").length;
        if (len > maxLen) maxLen = len;
      });
      col.width = Math.min(maxLen + 4, 50);
    });
  }

  // If no tables found, put full text in a single sheet
  if (sheetIndex === 0) {
    const sheet = workbook.addWorksheet("內容");
    const lines = markdown.split("\n");
    for (const line of lines) {
      sheet.addRow([line]);
    }
    sheet.getColumn(1).width = 80;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
