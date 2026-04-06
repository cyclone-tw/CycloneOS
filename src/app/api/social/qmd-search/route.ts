// src/app/api/social/qmd-search/route.ts
// POST — proxy for QMD search (query mode) or file fetch (file mode).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { query?: string; file?: string };

    const { execFileSync } = await import("child_process");

    if (body.query) {
      // --- Search mode ---
      let raw: string;
      try {
        raw = execFileSync("qmd", ["search", body.query, "--limit", "10", "--json"], {
          timeout: 10000,
          encoding: "utf-8",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ results: [], error: `qmd search error: ${msg}` });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.trim());
      } catch {
        return Response.json({ results: [], error: "Failed to parse qmd output" });
      }

      // qmd --json typically returns an array of hit objects
      const hits = Array.isArray(parsed) ? parsed : [];
      const results = hits.map((h: Record<string, unknown>) => ({
        title: String(h.title ?? h.path ?? ""),
        snippet: String(h.snippet ?? h.body ?? ""),
        file: String(h.file ?? h.path ?? ""),
        collection: String(h.collection ?? ""),
      }));

      return Response.json({ results });
    }

    if (body.file) {
      // --- Fetch full content mode ---
      let content: string;
      try {
        content = execFileSync("qmd", ["get", body.file], {
          timeout: 10000,
          encoding: "utf-8",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return Response.json({ content: null, error: `qmd get error: ${msg}` });
      }

      return Response.json({ content: content.trim() });
    }

    return Response.json({ results: [], error: "Must provide query or file" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ results: [], error: msg });
  }
}
