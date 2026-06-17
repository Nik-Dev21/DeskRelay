import { type NextRequest, NextResponse } from "next/server";
import { processMeeting } from "@/lib/worker";
import { getSummary } from "@/lib/redis";

// POST /api/meetings/process
// Triggers the DeepSeek extraction pipeline for a completed meeting.
// Called automatically when the Deepgram stream closes, or manually
// for uploaded audio files.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as {
    meetingId?: string;
    title?: string;
    participants?: Record<number, string>;
    forceReasoning?: boolean;
  };

  const { meetingId, title, participants, forceReasoning } = body;
  if (!meetingId) return NextResponse.json({ error: "meetingId required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Run async — client gets immediate 202, polls /api/meetings/[id] for results
  processMeeting(meetingId, title, participants ?? {}, forceReasoning ?? false).catch((err) =>
    console.error(`[process] pipeline error for ${meetingId}:`, err)
  );

  return NextResponse.json({ ok: true, meetingId, status: "processing" }, { status: 202 });
}

// GET /api/meetings/process?meetingId=xxx
// Poll for processing completion.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const meetingId = req.nextUrl.searchParams.get("meetingId");
  if (!meetingId) return NextResponse.json({ error: "meetingId required" }, { status: 400 });

  const summary = await getSummary(meetingId);
  if (!summary) return NextResponse.json({ status: "processing" }, { status: 202 });

  return NextResponse.json({ status: "done", summary });
}
