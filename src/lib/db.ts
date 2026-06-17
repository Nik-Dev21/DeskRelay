import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ManagerFocusItem, EmployeeActionItem, SignOffStatus, TaskStatus } from "@/types";

let _client: SupabaseClient | null = null;

function getDB(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    _client = createClient(url, key);
  }
  return _client;
}

// ── Manager Focus Items ────────────────────────────────────────────────────

export async function insertFocusItems(items: ManagerFocusItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = getDB();
  const rows = items.map((item) => ({
    id: item.id,
    meeting_id: item.meetingId,
    manager_name: item.managerName,
    team_name: item.teamName,
    checklist_item: item.checklistItem,
    context_summary: item.contextSummary,
    target_date: item.targetDate ?? null,
    status: item.status,
    is_signed_off: item.isSignedOff,
    is_blocker: item.isBlocker,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }));
  const { error } = await db.from("manager_focus_lists").insert(rows);
  if (error) throw new Error(`DB insert focus items: ${error.message}`);
}

export async function getFocusItems(filter?: {
  status?: SignOffStatus;
  teamName?: string;
  isBlocker?: boolean;
}): Promise<ManagerFocusItem[]> {
  const db = getDB();
  let query = db.from("manager_focus_lists").select("*").order("created_at", { ascending: false });
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.teamName) query = query.eq("team_name", filter.teamName);
  if (filter?.isBlocker !== undefined) query = query.eq("is_blocker", filter.isBlocker);

  const { data, error } = await query;
  if (error) throw new Error(`DB get focus items: ${error.message}`);
  return (data ?? []).map(rowToFocusItem);
}

export async function updateFocusItem(
  id: string,
  patch: Partial<Pick<ManagerFocusItem, "checklistItem" | "contextSummary" | "targetDate" | "status" | "isSignedOff" | "teamName">>
): Promise<ManagerFocusItem> {
  const db = getDB();
  const dbPatch: Record<string, unknown> = {};
  if (patch.checklistItem !== undefined) dbPatch.checklist_item = patch.checklistItem;
  if (patch.contextSummary !== undefined) dbPatch.context_summary = patch.contextSummary;
  if (patch.targetDate !== undefined) dbPatch.target_date = patch.targetDate;
  if (patch.teamName !== undefined) dbPatch.team_name = patch.teamName;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.isSignedOff !== undefined) {
    dbPatch.is_signed_off = patch.isSignedOff;
    dbPatch.status = patch.isSignedOff ? "SIGNED_OFF" : "PENDING_APPROVAL";
    dbPatch.signed_off_at = patch.isSignedOff ? new Date().toISOString() : null;
  }

  const { data, error } = await db
    .from("manager_focus_lists")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`DB update focus item: ${error.message}`);
  return rowToFocusItem(data);
}

// ── Employee Action Items ──────────────────────────────────────────────────

export async function insertTaskItems(items: EmployeeActionItem[]): Promise<void> {
  if (items.length === 0) return;
  const db = getDB();
  const rows = items.map((item) => ({
    id: item.id,
    meeting_id: item.meetingId,
    assigned_to: item.assignedTo,
    task_name: item.taskName,
    task_details: item.taskDetails,
    priority: item.priority,
    status: item.status,
    deadline: item.deadline ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }));
  const { error } = await db.from("employee_action_items").insert(rows);
  if (error) throw new Error(`DB insert task items: ${error.message}`);
}

export async function getTaskItems(filter?: {
  assignedTo?: string;
  status?: TaskStatus;
  priority?: "HIGH" | "MEDIUM" | "LOW";
}): Promise<EmployeeActionItem[]> {
  const db = getDB();
  let query = db.from("employee_action_items").select("*").order("created_at", { ascending: false });
  if (filter?.assignedTo) query = query.eq("assigned_to", filter.assignedTo);
  if (filter?.status) query = query.eq("status", filter.status);
  if (filter?.priority) query = query.eq("priority", filter.priority);

  const { data, error } = await query;
  if (error) throw new Error(`DB get task items: ${error.message}`);
  return (data ?? []).map(rowToTaskItem);
}

export async function updateTaskItem(
  id: string,
  patch: Partial<Pick<EmployeeActionItem, "taskName" | "taskDetails" | "status" | "priority" | "deadline" | "jiraTicketUrl" | "slackMessageTs">>
): Promise<EmployeeActionItem> {
  const db = getDB();
  const dbPatch: Record<string, unknown> = {};
  if (patch.taskName !== undefined) dbPatch.task_name = patch.taskName;
  if (patch.taskDetails !== undefined) dbPatch.task_details = patch.taskDetails;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.deadline !== undefined) dbPatch.deadline = patch.deadline;
  if (patch.jiraTicketUrl !== undefined) dbPatch.jira_ticket_url = patch.jiraTicketUrl;
  if (patch.slackMessageTs !== undefined) dbPatch.slack_message_ts = patch.slackMessageTs;

  const { data, error } = await db
    .from("employee_action_items")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`DB update task item: ${error.message}`);
  return rowToTaskItem(data);
}

// ── Row mappers ────────────────────────────────────────────────────────────

function rowToFocusItem(row: Record<string, unknown>): ManagerFocusItem {
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    managerName: row.manager_name as string,
    teamName: row.team_name as string,
    checklistItem: row.checklist_item as string,
    contextSummary: row.context_summary as string,
    targetDate: row.target_date as string | undefined,
    status: row.status as ManagerFocusItem["status"],
    isSignedOff: row.is_signed_off as boolean,
    signedOffAt: row.signed_off_at as string | undefined,
    isBlocker: row.is_blocker as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTaskItem(row: Record<string, unknown>): EmployeeActionItem {
  return {
    id: row.id as string,
    meetingId: row.meeting_id as string,
    assignedTo: row.assigned_to as string,
    taskName: row.task_name as string,
    taskDetails: row.task_details as string,
    priority: row.priority as EmployeeActionItem["priority"],
    status: row.status as EmployeeActionItem["status"],
    deadline: row.deadline as string | undefined,
    jiraTicketUrl: row.jira_ticket_url as string | undefined,
    slackMessageTs: row.slack_message_ts as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
