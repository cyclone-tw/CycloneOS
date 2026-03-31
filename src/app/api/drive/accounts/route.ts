// dashboard/src/app/api/drive/accounts/route.ts
import { DRIVE_ACCOUNTS } from "@/config/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const accounts = DRIVE_ACCOUNTS.map(({ id, email, label }) => ({
    id,
    email,
    label,
  }));
  return Response.json({ accounts });
}
