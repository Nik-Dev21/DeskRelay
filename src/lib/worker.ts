import type { MeetingTranscript, ExtractedAction } from "@/types";
import { buildTranscript, saveSummary, enqueueAction, updateActionStatus } from "./redis";
import { extractMeetingActions } from "./deepseek";
import { extractRoleItems } from "./deepseek-roles";
import { insertFocusItems, insertTaskItems } from "./db";
import { createJiraTicket, notifyEmployeeSlack, notifyManagerSignOff } from "./notifications";
import { draftCalendarEvent, draftEmail, getAvailableSlots } from "./graph";

// ── Post-meeting processing pipeline ──────────────────────────────────────
// Called once Deepgram closes the stream (meeting ended or file uploaded).
// Three DeepSeek calls run in parallel:
//   1. Executive summary + calendar/email action extraction (deepseek.ts)
//   2. Manager sign-off checklist extraction          (deepseek-roles.ts — Engine A)
//   3. Employee task extraction                        (deepseek-roles.ts — Engine B)

export async function processMeeting(
  meetingId: string,
  title: string,
  participants: Record<number, string> = {},
  forceReasoning = false
): Promise<void> {
  console.log(`[worker] processing meeting ${meetingId}`);

  const transcript: MeetingTranscript = await buildTranscript(meetingId, title, participants);

  const useReasoning = forceReasoning || transcript.rawText.length > 6000;

  // All three extractions run in parallel — DeepSeek caches static prefixes across all three
  const [summary, roleItems] = await Promise.all([
    extractMeetingActions(transcript, useReasoning),
    extractRoleItems(transcript),
  ]);

  // Persist all results concurrently
  await Promise.all([
    saveSummary(summary),
    insertFocusItems(roleItems.managerItems).catch((e) =>
      console.error("[worker] DB insert focus items failed:", e)
    ),
    insertTaskItems(roleItems.employeeItems).catch((e) =>
      console.error("[worker] DB insert task items failed:", e)
    ),
  ]);

  // Fan out: calendar conflict detection + Jira/Slack notifications in parallel
  await Promise.allSettled([
    ...summary.actions.map((action) => enrichAndEnqueue(action, participants)),
    ...roleItems.employeeItems.map((task) => dispatchEmployeeTask(task)),
    ...roleItems.managerItems.filter((item) => item.isBlocker).map(notifyManagerSignOff),
  ]);

  console.log(
    `[worker] meeting ${meetingId} done — ` +
    `${summary.actions.length} calendar actions, ` +
    `${roleItems.managerItems.length} focus items, ` +
    `${roleItems.employeeItems.length} employee tasks`
  );
}

async function dispatchEmployeeTask(task: import("@/types").EmployeeActionItem): Promise<void> {
  try {
    const jiraUrl = await createJiraTicket(task);
    if (jiraUrl) {
      await updateTaskItem(task.id, { jiraTicketUrl: jiraUrl });
      task.jiraTicketUrl = jiraUrl;
    }
    const ts = await notifyEmployeeSlack(task);
    if (ts) await updateTaskItem(task.id, { slackMessageTs: ts });
  } catch (err) {
    console.error(`[worker] employee task dispatch failed for ${task.id}:`, err);
  }
}

async function updateTaskItem(
  id: string,
  patch: Parameters<typeof import("./db").updateTaskItem>[1]
): Promise<void> {
  try {
    const { updateTaskItem: dbUpdate } = await import("./db");
    await dbUpdate(id, patch);
  } catch (e) {
    console.error("[worker] updateTaskItem failed:", e);
  }
}

async function enrichAndEnqueue(
  action: ExtractedAction,
  participants: Record<number, string>
): Promise<void> {
  try {
    if (action.intent === "BOOK_MEETING" && action.inferredDate) {
      const userEmail = process.env.EXEC_EMAIL ?? "";
      if (userEmail) {
        const slots = await getAvailableSlots(
          userEmail,
          action.inferredDate,
          action.durationMinutes ?? 60
        );
        action.conflictsWith = slots.filter((s) => !s.isAvailable);
        action.suggestedAlternatives = slots.filter((s) => s.isAvailable).slice(0, 3);
      }
    }
    await enqueueAction(action);
  } catch (err) {
    console.error(`[worker] enrich failed for action ${action.id}:`, err);
    // Still enqueue without conflict data rather than dropping
    await enqueueAction(action);
  }
}

// ── Dispatch: called after human approves an action ──────────────────────

export async function dispatchAction(actionId: string, action: ExtractedAction): Promise<void> {
  console.log(`[worker] dispatching action ${actionId} (${action.intent})`);

  try {
    switch (action.intent) {
      case "BOOK_MEETING": {
        const eventId = await draftCalendarEvent(action);
        console.log(`[worker] calendar event drafted: ${eventId}`);
        // sendCalendarEvent(eventId) — uncomment after confirming live Graph access
        break;
      }
      case "SEND_EMAIL": {
        const msgId = await draftEmail(action);
        console.log(`[worker] email drafted: ${msgId}`);
        // sendEmail(msgId) — uncomment after confirming live Graph access
        break;
      }
      case "CREATE_TASK":
        console.log(`[worker] task created: ${action.taskDescription}`);
        // TODO: POST to Planner / Jira / Linear via webhook
        break;
      case "UPLOAD_NOTES":
        console.log(`[worker] notes upload queued for meeting ${action.meetingId}`);
        // TODO: upload to SharePoint / Notion
        break;
      case "SET_REMINDER":
        console.log(`[worker] reminder set for ${action.inferredDate}`);
        // TODO: Graph /me/reminderView or Teams webhook
        break;
    }

    await updateActionStatus(actionId, "dispatched");
  } catch (err) {
    console.error(`[worker] dispatch failed for ${actionId}:`, err);
    await updateActionStatus(actionId, "failed");
    throw err;
  }
}
