// dashboard/src/app/api/gmail/labels/route.ts
import { getGmailClient } from "@/lib/gmail-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json(
      { error: "Gmail not configured", configured: false },
      { status: 503 }
    );
  }

  try {
    const res = await gmail.users.labels.list({ userId: "me" });
    const labels = (res.data.labels ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
    }));

    return Response.json({ labels });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
