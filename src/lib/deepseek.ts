import OpenAI from "openai";
import { z } from "zod";
import type { MeetingTranscript, ExtractedAction, MeetingSummary, ActionIntent } from "@/types";
import { randomUUID } from "crypto";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
    _client = new OpenAI({
      baseURL: "https://api.deepseek.com/v1",
      apiKey: key,
    });
  }
  return _client;
}

// ── Deterministic static system prompt (maximises prefix cache hit rate) ──
// DeepSeek caches prompt prefixes automatically. This block is ALWAYS identical
// so it hits the 90% discount on repeated calls.
const STATIC_SYSTEM_PROMPT = `You are WorkBoard's executive meeting intelligence engine. You extract structured calendar and task actions from enterprise meeting transcripts.

TOOLS AVAILABLE:
- BOOK_MEETING  → schedule a calendar event with specific attendees and time
- SEND_EMAIL    → draft and send an email to one or more participants
- CREATE_TASK   → create a tracked task item in the project workspace
- UPLOAD_NOTES  → attach meeting notes to a project document
- SET_REMINDER  → set a follow-up reminder for a specific time

EXTRACTION RULES:
1. Only extract items with EXPLICIT intent — do not infer vague statements as actions.
2. For dates, always resolve relative terms ("next Thursday", "end of week") to ISO 8601.
3. Attendees must be identified from the speaker names or explicit mentions.
4. Generate a brief, dense executive summary (≤ 3 sentences).
5. List key decisions (bullet points, max 5).
6. List open items that were not resolved.
7. Output ONLY valid JSON — no prose, no markdown code fences.

OUTPUT SCHEMA:
{
  "headline": "<3-sentence executive summary>",
  "keyDecisions": ["<decision>", ...],
  "openItems": ["<item>", ...],
  "actions": [
    {
      "intent": "<ACTION_TYPE>",
      "attendees": ["<name>", ...],
      "subject": "<optional email subject or meeting title>",
      "body": "<optional email body or meeting description>",
      "inferredDate": "<ISO 8601 datetime or null>",
      "durationMinutes": <number or null>,
      "location": "<optional Teams/Zoom/room>",
      "taskDescription": "<optional task detail>",
      "priority": "<high|medium|low or null>",
      "rawTranscriptRef": "<verbatim quote that triggered this action>"
    }
  ]
}`;

const ActionSchema = z.object({
  intent: z.enum(["BOOK_MEETING", "SEND_EMAIL", "CREATE_TASK", "UPLOAD_NOTES", "SET_REMINDER"]),
  attendees: z.array(z.string()),
  subject: z.string().optional(),
  body: z.string().optional(),
  inferredDate: z.string().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  location: z.string().optional(),
  taskDescription: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).nullable().optional(),
  rawTranscriptRef: z.string(),
});

const ResponseSchema = z.object({
  headline: z.string(),
  keyDecisions: z.array(z.string()),
  openItems: z.array(z.string()),
  actions: z.array(ActionSchema),
});

// ── Main extraction function (Flash model, prompt-cached static prefix) ────

export async function extractMeetingActions(
  transcript: MeetingTranscript,
  useReasoning = false
): Promise<MeetingSummary> {
  const client = getClient();
  const model = useReasoning ? "deepseek-reasoner" : "deepseek-chat";

  const dynamicBlock = buildDynamicBlock(transcript);

  const response = await client.chat.completions.create({
    model,
    max_tokens: 1200,
    messages: [
      { role: "system", content: STATIC_SYSTEM_PROMPT },
      { role: "user", content: dynamicBlock },
    ],
    // DeepSeek automatically caches the system prompt prefix on repeated calls
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = ResponseSchema.safeParse(parseJSON(raw));

  if (!parsed.success) {
    console.error("[deepseek] schema parse error:", parsed.error.flatten());
    throw new Error("DeepSeek returned malformed JSON");
  }

  const now = new Date().toISOString();
  const actions: ExtractedAction[] = parsed.data.actions.map((a) => ({
    id: randomUUID(),
    meetingId: transcript.meetingId,
    intent: a.intent as ActionIntent,
    attendees: a.attendees,
    subject: a.subject,
    body: a.body,
    inferredDate: a.inferredDate ?? undefined,
    durationMinutes: a.durationMinutes ?? undefined,
    location: a.location,
    taskDescription: a.taskDescription,
    priority: a.priority ?? undefined,
    status: "pending",
    rawTranscriptRef: a.rawTranscriptRef,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    meetingId: transcript.meetingId,
    headline: parsed.data.headline,
    keyDecisions: parsed.data.keyDecisions,
    openItems: parsed.data.openItems,
    actions,
    generatedAt: now,
  };
}

function buildDynamicBlock(transcript: MeetingTranscript): string {
  const speakerMap = transcript.participants;
  const labelledText = transcript.segments
    .map((s) => {
      const name = speakerMap[s.speaker] ?? `Speaker ${s.speaker}`;
      return `[${name}]: ${s.text}`;
    })
    .join("\n");

  return `MEETING: ${transcript.title}
DATE: ${transcript.startedAt}
PARTICIPANTS: ${Object.values(speakerMap).join(", ") || "Unknown"}
TODAY_DATE: ${new Date().toISOString().split("T")[0]}

TRANSCRIPT:
${labelledText}

Extract all actions and produce the JSON summary now.`;
}

// ── Quick summary for the approval card (Flash, ≤ 400 tokens, off-peak OK) ─

export async function quickSummary(text: string): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 400,
    messages: [
      {
        role: "system",
        content: "Summarise this meeting transcript in 2-3 tight sentences for an executive. Output only the summary.",
      },
      { role: "user", content: text },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // strip markdown fences if model added them despite instructions
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Cannot parse JSON from DeepSeek response");
  }
}
