// dashboard/src/app/api/gmail/messages/route.ts
import { type NextRequest } from "next/server";
import { getGmailClient, parseMessage } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json(
      { error: "Gmail not configured", configured: false },
      { status: 503 }
    );
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") || "is:unread";
  const maxResults = Math.min(Number(searchParams.get("maxResults") || "20"), 50);
  const pageToken = searchParams.get("pageToken") || undefined;

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults,
      pageToken,
    });

    const messageIds = listRes.data.messages ?? [];
    if (messageIds.length === 0) {
      return Response.json({
        messages: [],
        nextPageToken: null,
        resultSizeEstimate: 0,
      });
    }

    // Batch fetch message details (metadata only for list view)
    const messages = await Promise.all(
      messageIds.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: id!,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date"],
        });
        return parseMessage(msg.data);
      })
    );

    return Response.json({
      messages,
      nextPageToken: listRes.data.nextPageToken ?? null,
      resultSizeEstimate: listRes.data.resultSizeEstimate ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
