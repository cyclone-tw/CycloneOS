// dashboard/src/app/api/gmail/thread/route.ts
import { type NextRequest } from "next/server";
import { getGmailClient, parseThreadMessage } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json(
      { error: "Gmail not configured", configured: false },
      { status: 503 }
    );
  }

  const threadId = request.nextUrl.searchParams.get("threadId");
  if (!threadId) {
    return Response.json({ error: "threadId is required" }, { status: 400 });
  }

  try {
    const res = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    const messages = (res.data.messages ?? []).map(parseThreadMessage);

    return Response.json({
      id: res.data.id,
      messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
