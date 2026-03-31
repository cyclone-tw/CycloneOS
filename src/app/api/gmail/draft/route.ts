// dashboard/src/app/api/gmail/draft/route.ts
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
    const { to, subject, content, threadId } = body as {
      to: string;
      subject: string;
      content: string;
      threadId?: string;
    };

    if (!to || !subject || !content) {
      return Response.json(
        { error: "to, subject, and content are required" },
        { status: 400 }
      );
    }

    // Build RFC 2822 message
    const rawMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      content,
    ].join("\r\n");

    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64url");

    const res = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedMessage,
          threadId: threadId || undefined,
        },
      },
    });

    return Response.json({
      id: res.data.id,
      messageId: res.data.message?.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
