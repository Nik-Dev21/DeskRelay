import type { EmployeeActionItem, ManagerFocusItem } from "@/types";

// ── Slack Webhook Notifications ────────────────────────────────────────────

export async function notifyEmployeeSlack(item: EmployeeActionItem): Promise<string | undefined> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return undefined;

  const priorityEmoji = { HIGH: "🔴", MEDIUM: "🟡", LOW: "🟢" }[item.priority];
  const deadline = item.deadline
    ? `*Due:* ${new Date(item.deadline).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
    : "";

  const payload = {
    text: `Hey ${item.assignedTo} — a new task was assigned to you from a recent meeting:`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${priorityEmoji} ${item.taskName}`, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: item.taskDetails },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `*Priority:* ${item.priority}  ${deadline}` },
        ],
      },
      ...(item.jiraTicketUrl
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View in Jira" },
                  url: item.jiraTicketUrl,
                },
              ],
            },
          ]
        : []),
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`[notifications] Slack failed: ${res.status} ${await res.text()}`);
    return undefined;
  }

  return res.headers.get("x-slack-message-ts") ?? undefined;
}

export async function notifyManagerSignOff(item: ManagerFocusItem): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const blockerWarning = item.isBlocker ? " *🚧 THIS IS A BLOCKER*" : "";
  const deadline = item.targetDate
    ? `*Target:* ${new Date(item.targetDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
    : "";

  const payload = {
    text: `WorkBoard: New sign-off required from ${item.managerName} (${item.teamName})`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `Sign-off Required: ${item.checklistItem}`, emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${item.contextSummary}${blockerWarning}`,
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `*Manager:* ${item.managerName}  |  *Team:* ${item.teamName}  |  ${deadline}` },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error(`[notifications] Slack sign-off notify failed: ${res.status}`);
}

// ── Jira Ticket Creation ───────────────────────────────────────────────────

interface JiraTicketResponse {
  id: string;
  key: string;
  self: string;
}

export async function createJiraTicket(item: EmployeeActionItem): Promise<string | undefined> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const projectKey = process.env.JIRA_PROJECT_KEY;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !projectKey || !email || !token) return undefined;

  const priorityMap = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

  const body = {
    fields: {
      project: { key: projectKey },
      summary: item.taskName,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: item.taskDetails }],
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: `Assigned to: ${item.assignedTo}`, marks: [{ type: "strong" }] },
            ],
          },
        ],
      },
      issuetype: { name: "Task" },
      priority: { name: priorityMap[item.priority] },
      ...(item.deadline ? { duedate: item.deadline.split("T")[0] } : {}),
    },
  };

  const credentials = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`[notifications] Jira ticket creation failed: ${res.status} ${await res.text()}`);
    return undefined;
  }

  const data = (await res.json()) as JiraTicketResponse;
  return `${baseUrl}/browse/${data.key}`;
}
