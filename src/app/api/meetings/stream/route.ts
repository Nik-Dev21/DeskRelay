import { type NextRequest, NextResponse } from "next/server";
import { createLiveStream } from "@/lib/deepgram";
import { appendChunk } from "@/lib/redis";
import type { TranscriptChunk } from "@/types";

// POST /api/meetings/stream
// Body: { meetingId, audioChunk: base64-encoded PCM/Opus bytes }
// This endpoint proxies raw audio bytes to Deepgram's WebSocket and stores
// each returned transcript chunk in Redis.
//
// For production, the meeting bot (Recall.ai / ACS) posts audio frames here.
// A persistent WebSocket connection per meeting is maintained server-side.

const activeStreams = new Map<string, ReturnType<typeof createLiveStream>>();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as {
    meetingId?: string;
    audioChunk?: string;
    action?: "open" | "close";
  };

  const { meetingId, audioChunk, action } = body;
  if (!meetingId) return NextResponse.json({ error: "meetingId required" }, { status: 400 });

  if (action === "open") {
    if (activeStreams.has(meetingId)) {
      return NextResponse.json({ ok: true, status: "already_open" });
    }

    const chunks: TranscriptChunk[] = [];
    const conn = createLiveStream({
      meetingId,
      onChunk: async (chunk) => {
        chunks.push(chunk);
        await appendChunk(meetingId, chunk).catch((e) =>
          console.error("[stream] redis write error:", e)
        );
      },
      onError: (err) => console.error(`[stream] deepgram error for ${meetingId}:`, err),
      onClose: () => {
        activeStreams.delete(meetingId);
        console.log(`[stream] closed for meeting ${meetingId}`);
      },
    });

    activeStreams.set(meetingId, conn);
    return NextResponse.json({ ok: true, status: "opened" });
  }

  if (action === "close") {
    const conn = activeStreams.get(meetingId);
    if (conn) {
      conn.requestClose();
      activeStreams.delete(meetingId);
    }
    return NextResponse.json({ ok: true, status: "closed" });
  }

  // Default: push audio chunk to existing stream
  if (!audioChunk) return NextResponse.json({ error: "audioChunk required" }, { status: 400 });

  const conn = activeStreams.get(meetingId);
  if (!conn) return NextResponse.json({ error: "stream not open — call action=open first" }, { status: 404 });

  const nodeBuffer = Buffer.from(audioChunk, "base64");
  // Deepgram SDK expects ArrayBuffer; slice() returns a proper ArrayBuffer copy
  conn.send(nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength) as ArrayBuffer);

  return NextResponse.json({ ok: true });
}
