import { type NextRequest } from "next/server";
import { getGmailClient } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json({ error: "Gmail not configured" }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");
  const mimeType = searchParams.get("mimeType") ?? "image/png";

  if (!messageId || !attachmentId) {
    return Response.json(
      { error: "messageId and attachmentId are required" },
      { status: 400 }
    );
  }

  try {
    const res = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });

    const data = res.data.data;
    if (!data) {
      return Response.json({ error: "No attachment data" }, { status: 404 });
    }

    const buffer = Buffer.from(data, "base64url");

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
