export interface SpeakerSegment {
  speaker: number;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface MeetingTranscript {
  meetingId: string;
  title: string;
  startedAt: string;
  segments: SpeakerSegment[];
  participants: Record<number, string>;
  rawText: string;
}

export type TranscriptChunk = Pick<SpeakerSegment, "speaker" | "text" | "start">;
