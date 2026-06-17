export type SignOffStatus = "PENDING_APPROVAL" | "IN_REVIEW" | "SIGNED_OFF" | "DEFERRED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

export interface ManagerFocusItem {
  id: string;
  meetingId: string;
  managerId?: string;
  managerName: string;
  teamName: string;
  checklistItem: string;
  contextSummary: string;
  targetDate?: string;
  status: SignOffStatus;
  isSignedOff: boolean;
  signedOffAt?: string;
  isBlocker: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeActionItem {
  id: string;
  meetingId: string;
  employeeId?: string;
  assignedTo: string;
  taskName: string;
  taskDetails: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: TaskStatus;
  deadline?: string;
  jiraTicketUrl?: string;
  slackMessageTs?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DualExtractionResult {
  managerItems: ManagerFocusItem[];
  employeeItems: EmployeeActionItem[];
}
