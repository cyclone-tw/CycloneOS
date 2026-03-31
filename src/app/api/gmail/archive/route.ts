// dashboard/src/app/api/gmail/archive/route.ts
import { type NextRequest } from "next/server";
import { getGmailClient } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json(
      { error: "Gmail not configured", configured: false },
      { status: 503 }
    );
  }

  try {
    const { messageIds } = (await request.json()) as {
      messageIds: string[];
    };

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return Response.json(
        { error: "messageIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Archive = remove INBOX label
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: messageIds,
        removeLabelIds: ["INBOX"],
      },
    });

    return Response.json({ success: true, count: messageIds.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
