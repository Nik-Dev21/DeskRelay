import { NextResponse } from "next/server";
import { getPendingActions } from "@/lib/redis";

// GET /api/actions — returns all pending actions for the approval queue

export async function GET(): Promise<NextResponse> {
  const actions = await getPendingActions();
  // Sort most recent first
  actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json(actions);
}
