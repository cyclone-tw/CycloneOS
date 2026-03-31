// dashboard/src/app/api/gmail/labels/manage/route.ts
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
    const body = await request.json();
    const { messageIds, addLabelIds, removeLabelIds } = body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return Response.json(
        { error: "messageIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!addLabelIds && !removeLabelIds) {
      return Response.json(
        { error: "At least one of addLabelIds or removeLabelIds is required" },
        { status: 400 }
      );
    }

    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: messageIds,
        addLabelIds: addLabelIds ?? [],
        removeLabelIds: removeLabelIds ?? [],
      },
    });

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
