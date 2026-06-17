import OpenAI from "openai";
import { z } from "zod";
import type { MeetingTranscript, ManagerFocusItem, EmployeeActionItem, DualExtractionResult } from "@/types";
import { randomUUID } from "crypto";

function getClient(): OpenAI {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");
  return new OpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey: key });
}

// ── Engine A: Manager / Executive Sign-Off Items ───────────────────────────
// Static prefix is ALWAYS identical → maximises DeepSeek prefix cache hit rate

const MANAGER_SYSTEM_PROMPT = `You are WorkBoard's executive intelligence engine specialised in extracting managerial oversight items from enterprise meeting transcripts.

EXTRACT ONLY items that require a manager's or executive's explicit sign-off, approval, or awareness:
- Budget approvals or spending authorisations
- Project milestone completions requiring formal sign-off
- Compliance, legal, or regulatory checkpoints
- Deliverable acceptance criteria
- Go/no-go decisions at senior level
- Cross-team blockers that only leadership can unblock

RULES:
1. Only extract items with EXPLICIT senior accountability — skip routine task updates.
2. Mark is_blocker: true if the item is actively preventing team progress.
3. Identify the responsible manager by name from the transcript context.
4. Assign the team name if determinable (e.g. "Engineering", "Design", "Ops").
5. Resolve relative dates to ISO 8601 using TODAY_DATE provided.
6. Output ONLY valid JSON — no prose, no markdown fences.

OUTPUT SCHEMA:
{
  "items": [
    {
      "managerName": "<name or 'Unknown'>",
      "teamName": "<team or ''>",
      "checklistItem": "<concise milestone title>",
      "contextSummary": "<1-2 sentence rationale from transcript>",
      "targetDate": "<ISO 8601 or null>",
      "status": "PENDING_APPROVAL",
      "isBlocker": <true|false>
    }
  ]
}`;

// ── Engine B: Employee / Operational Task Items ────────────────────────────

const EMPLOYEE_SYSTEM_PROMPT = `You are WorkBoard's task extraction engine specialised in identifying granular employee action items from enterprise meeting transcripts.

EXTRACT ONLY concrete operational tasks assigned to specific individuals:
- Code changes, bug fixes, feature implementations
- Design deliverables (mockups, specs, assets)
- Documentation and reporting tasks
- Infrastructure, DevOps, deployment work
- Client or vendor communication tasks
- Testing and QA assignments

RULES:
1. Only extract tasks with a NAMED assignee — discard vague "someone should" statements.
2. Infer priority: HIGH if mentioned as urgent/blocking, LOW if nice-to-have, MEDIUM otherwise.
3. Resolve relative deadlines to ISO 8601 using TODAY_DATE provided.
4. task_details should include enough context for the employee to act without listening to the recording.
5. Output ONLY valid JSON — no prose, no markdown fences.

OUTPUT SCHEMA:
{
  "items": [
    {
      "assignedTo": "<full name>",
      "taskName": "<short imperative title>",
      "taskDetails": "<full context and acceptance criteria>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "status": "TODO",
      "deadline": "<ISO 8601 or null>"
    }
  ]
}`;

// ── Zod schemas ────────────────────────────────────────────────────────────

const ManagerItemSchema = z.object({
  managerName: z.string(),
  teamName: z.string(),
  checklistItem: z.string(),
  contextSummary: z.string(),
  targetDate: z.string().nullable().optional(),
  status: z.literal("PENDING_APPROVAL"),
  isBlocker: z.boolean(),
});

const EmployeeItemSchema = z.object({
  assignedTo: z.string(),
  taskName: z.string(),
  taskDetails: z.string(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  status: z.literal("TODO"),
  deadline: z.string().nullable().optional(),
});

// ── Dual parallel extraction ───────────────────────────────────────────────
// Both engines share the same dynamic transcript block injected at the user turn.
// DeepSeek caches each static system prompt independently → two cache hits per call.

export async function extractRoleItems(transcript: MeetingTranscript): Promise<DualExtractionResult> {
  const client = getClient();
  const dynamicBlock = buildDynamicBlock(transcript);

  const [managerResult, employeeResult] = await Promise.all([
    client.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 800,
      messages: [
        { role: "system", content: MANAGER_SYSTEM_PROMPT },
        { role: "user", content: dynamicBlock },
      ],
    }),
    client.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 800,
      messages: [
        { role: "system", content: EMPLOYEE_SYSTEM_PROMPT },
        { role: "user", content: dynamicBlock },
      ],
    }),
  ]);

  const now = new Date().toISOString();

  const managerRaw = parseJSON(managerResult.choices[0]?.message?.content ?? "{}") as { items?: unknown[] };
  const employeeRaw = parseJSON(employeeResult.choices[0]?.message?.content ?? "{}") as { items?: unknown[] };

  const managerItems: ManagerFocusItem[] = (managerRaw.items ?? [])
    .map((item) => ManagerItemSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => {
      const d = (r as { success: true; data: z.infer<typeof ManagerItemSchema> }).data;
      return {
        id: randomUUID(),
        meetingId: transcript.meetingId,
        managerName: d.managerName,
        teamName: d.teamName,
        checklistItem: d.checklistItem,
        contextSummary: d.contextSummary,
        targetDate: d.targetDate ?? undefined,
        status: d.status,
        isSignedOff: false,
        isBlocker: d.isBlocker,
        createdAt: now,
        updatedAt: now,
      };
    });

  const employeeItems: EmployeeActionItem[] = (employeeRaw.items ?? [])
    .map((item) => EmployeeItemSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => {
      const d = (r as { success: true; data: z.infer<typeof EmployeeItemSchema> }).data;
      return {
        id: randomUUID(),
        meetingId: transcript.meetingId,
        assignedTo: d.assignedTo,
        taskName: d.taskName,
        taskDetails: d.taskDetails,
        priority: d.priority,
        status: d.status,
        deadline: d.deadline ?? undefined,
        createdAt: now,
        updatedAt: now,
      };
    });

  return { managerItems, employeeItems };
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
TODAY_DATE: ${new Date().toISOString().split("T")[0]}
PARTICIPANTS: ${Object.values(speakerMap).join(", ") || "Unknown"}

TRANSCRIPT:
${labelledText}`;
}

function parseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return {};
  }
}
