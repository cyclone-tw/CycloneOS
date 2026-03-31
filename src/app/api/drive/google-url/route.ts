// Resolve Google native file (.gdoc/.gsheet/.gslides/.gscript) to its web URL
import { NextRequest } from "next/server";
import { getStorageProvider } from "@/lib/providers/registry";

export const dynamic = "force-dynamic";

const GOOGLE_URL_MAP: Record<string, string> = {
  ".gdoc": "https://docs.google.com/document/d/",
  ".gsheet": "https://docs.google.com/spreadsheets/d/",
  ".gslides": "https://docs.google.com/presentation/d/",
  ".gscript": "https://script.google.com/d/",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get("accountId");
  const filePath = searchParams.get("path");

  if (!accountId || !filePath) {
    return Response.json({ error: "accountId and path are required" }, { status: 400 });
  }

  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const baseUrl = GOOGLE_URL_MAP[ext];
  if (!baseUrl) {
    return Response.json({ error: "Not a Google native file" }, { status: 400 });
  }

  try {
    const provider = getStorageProvider(accountId);
    const buffer = await provider.readFile(filePath, 10000); // short timeout, these are tiny files
    const json = JSON.parse(buffer.toString("utf-8"));
    const docId = json.doc_id;

    if (!docId) {
      return Response.json({ error: "No doc_id found" }, { status: 422 });
    }

    return Response.json({ url: `${baseUrl}${docId}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
