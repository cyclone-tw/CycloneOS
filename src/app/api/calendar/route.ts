import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// TODO: Google Calendar API integration plan
// 1. Set up Google Cloud project with Calendar API enabled
// 2. Create OAuth 2.0 credentials (or use a service account for read-only access)
// 3. Store refresh token in GOOGLE_CALENDAR_REFRESH_TOKEN env var
// 4. On each request, exchange refresh token for access token
// 5. Fetch events from: https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
//    with timeMin=today start, timeMax=tomorrow end, singleEvents=true, orderBy=startTime
// 6. Map to CalendarEvent shape: { id, title, startTime, endTime, location, url }

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  url: string | null;
}

export async function GET(request: NextRequest) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!calendarId) {
    return Response.json({ events: [], configured: false });
  }

  // Google Calendar OAuth is not yet implemented.
  // Return an empty list with a message indicating the integration is pending.
  return Response.json({
    events: [] as CalendarEvent[],
    configured: true,
    message: "Google Calendar OAuth not yet implemented",
  });
}
