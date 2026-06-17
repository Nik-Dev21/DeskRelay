import type { ExtractedAction, CalendarSlot } from "@/types";

// ── Microsoft Graph API client (token via client credentials flow) ─────────

interface TokenCache {
  token: string;
  expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure AD credentials (AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET) are not set");
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, { method: "POST", body });
  if (!res.ok) throw new Error(`Graph token error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _tokenCache.token;
}

async function graphFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Graph API error ${res.status} on ${path}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

// ── Calendar availability check ────────────────────────────────────────────

export async function getAvailableSlots(
  userEmail: string,
  around: string, // ISO 8601
  durationMinutes = 60,
  windowDays = 3
): Promise<CalendarSlot[]> {
  const start = new Date(around);
  const end = new Date(start.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const body = {
    schedules: [userEmail],
    startTime: { dateTime: start.toISOString(), timeZone: "UTC" },
    endTime: { dateTime: end.toISOString(), timeZone: "UTC" },
    availabilityViewInterval: durationMinutes,
  };

  const data = (await graphFetch("/me/calendar/getSchedule", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { value: Array<{ availabilityView: string; scheduleItems: Array<{ subject: string; start: { dateTime: string }; end: { dateTime: string } }> }> };

  const schedule = data.value[0];
  const slots: CalendarSlot[] = [];
  const view = schedule.availabilityView ?? "";

  for (let i = 0; i < view.length; i++) {
    const slotStart = new Date(start.getTime() + i * durationMinutes * 60 * 1000);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
    const isAvailable = view[i] === "0";
    const conflict = schedule.scheduleItems.find(
      (item) => new Date(item.start.dateTime) < slotEnd && new Date(item.end.dateTime) > slotStart
    );
    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      isAvailable,
      conflictTitle: conflict?.subject,
    });
  }

  return slots;
}

// ── Calendar event creation (draft → requires approval before send) ─────────

export async function draftCalendarEvent(action: ExtractedAction): Promise<string> {
  const event = {
    subject: action.subject ?? "Meeting (WorkBoard AI Draft)",
    body: { contentType: "HTML", content: action.body ?? "" },
    start: {
      dateTime: action.inferredDate ?? new Date().toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: new Date(
        new Date(action.inferredDate ?? Date.now()).getTime() + (action.durationMinutes ?? 60) * 60 * 1000
      ).toISOString(),
      timeZone: "UTC",
    },
    location: action.location ? { displayName: action.location } : undefined,
    attendees: action.attendees.map((a) => ({
      emailAddress: { address: a, name: a },
      type: "required",
    })),
    isOrganizer: true,
    // Draft flag — won't send invites until explicitly confirmed
    isDraft: true,
  };

  const created = (await graphFetch("/me/events", {
    method: "POST",
    body: JSON.stringify(event),
  })) as { id: string };

  return created.id;
}

export async function sendCalendarEvent(eventId: string): Promise<void> {
  await graphFetch(`/me/events/${eventId}/send`, { method: "POST" });
}

// ── Email drafting ──────────────────────────────────────────────────────────

export async function draftEmail(action: ExtractedAction): Promise<string> {
  const message = {
    subject: action.subject ?? "Follow-up (WorkBoard AI)",
    body: { contentType: "HTML", content: action.body ?? "" },
    toRecipients: action.attendees.map((a) => ({
      emailAddress: { address: a, name: a },
    })),
    isDraft: true,
  };

  const created = (await graphFetch("/me/messages", {
    method: "POST",
    body: JSON.stringify(message),
  })) as { id: string };

  return created.id;
}

export async function sendEmail(messageId: string): Promise<void> {
  await graphFetch(`/me/messages/${messageId}/send`, { method: "POST" });
}
