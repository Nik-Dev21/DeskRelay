import Redis from "ioredis";
import type { TranscriptChunk, MeetingTranscript, ExtractedAction, MeetingSummary } from "@/types";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
    _redis.on("error", (err) => console.error("[redis] error:", err.message));
  }
  return _redis;
}

// ── Transcript chunks (live ring buffer, 24h TTL) ──────────────────────────

const CHUNK_TTL = 86400; // 24 h
const SUMMARY_TTL = 604800; // 7 days
const ACTION_TTL = 604800;

export async function appendChunk(meetingId: string, chunk: TranscriptChunk): Promise<void> {
  const r = getRedis();
  const key = `meeting:${meetingId}:chunks`;
  await r.rpush(key, JSON.stringify(chunk));
  await r.expire(key, CHUNK_TTL);
}

export async function getChunks(meetingId: string): Promise<TranscriptChunk[]> {
  const r = getRedis();
  const raw = await r.lrange(`meeting:${meetingId}:chunks`, 0, -1);
  return raw.map((s) => JSON.parse(s) as TranscriptChunk);
}

export async function buildTranscript(
  meetingId: string,
  title: string,
  participants: Record<number, string> = {}
): Promise<MeetingTranscript> {
  const chunks = await getChunks(meetingId);
  const rawText = chunks.map((c) => `[Speaker ${c.speaker}] ${c.text}`).join("\n");
  return {
    meetingId,
    title,
    startedAt: new Date().toISOString(),
    segments: chunks.map((c) => ({ ...c, end: c.start, confidence: 1 })),
    participants,
    rawText,
  };
}

// ── Summary storage ────────────────────────────────────────────────────────

export async function saveSummary(summary: MeetingSummary): Promise<void> {
  const r = getRedis();
  const key = `meeting:${summary.meetingId}:summary`;
  await r.set(key, JSON.stringify(summary), "EX", SUMMARY_TTL);
}

export async function getSummary(meetingId: string): Promise<MeetingSummary | null> {
  const r = getRedis();
  const raw = await r.get(`meeting:${meetingId}:summary`);
  return raw ? (JSON.parse(raw) as MeetingSummary) : null;
}

// ── Action queue ───────────────────────────────────────────────────────────

export async function enqueueAction(action: ExtractedAction): Promise<void> {
  const r = getRedis();
  await r.hset("actions:pending", action.id, JSON.stringify(action));
  await r.expire("actions:pending", ACTION_TTL);
}

export async function getPendingActions(): Promise<ExtractedAction[]> {
  const r = getRedis();
  const map = await r.hgetall("actions:pending");
  return Object.values(map).map((s) => JSON.parse(s) as ExtractedAction);
}

export async function updateActionStatus(
  id: string,
  status: ExtractedAction["status"]
): Promise<void> {
  const r = getRedis();
  const raw = await r.hget("actions:pending", id);
  if (!raw) return;
  const action = JSON.parse(raw) as ExtractedAction;
  action.status = status;
  action.updatedAt = new Date().toISOString();
  if (status === "approved" || status === "rejected" || status === "dispatched") {
    await r.hdel("actions:pending", id);
    await r.hset(`actions:${status}`, id, JSON.stringify(action));
  } else {
    await r.hset("actions:pending", id, JSON.stringify(action));
  }
}

export async function getAction(id: string): Promise<ExtractedAction | null> {
  const r = getRedis();
  for (const bucket of ["actions:pending", "actions:approved", "actions:rejected", "actions:dispatched"]) {
    const raw = await r.hget(bucket, id);
    if (raw) return JSON.parse(raw) as ExtractedAction;
  }
  return null;
}
