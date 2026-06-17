export type ActionIntent =
  | "BOOK_MEETING"
  | "SEND_EMAIL"
  | "CREATE_TASK"
  | "UPLOAD_NOTES"
  | "SET_REMINDER";

export type ActionStatus = "pending" | "approved" | "rejected" | "dispatched" | "failed";

export interface ExtractedAction {
  id: string;
  meetingId: string;
  intent: ActionIntent;
  attendees: string[];
  subject?: string;
  body?: string;
  inferredDate?: string;
  durationMinutes?: number;
  location?: string;
  taskDescription?: string;
  priority?: "high" | "medium" | "low";
  status: ActionStatus;
  conflictsWith?: CalendarSlot[];
  suggestedAlternatives?: CalendarSlot[];
  createdAt: string;
  updatedAt: string;
  rawTranscriptRef: string;
}

export interface CalendarSlot {
  start: string;
  end: string;
  isAvailable: boolean;
  conflictTitle?: string;
}

export interface MeetingSummary {
  meetingId: string;
  headline: string;
  keyDecisions: string[];
  openItems: string[];
  actions: ExtractedAction[];
  generatedAt: string;
}
