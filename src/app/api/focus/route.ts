import { type NextRequest, NextResponse } from "next/server";
import { getFocusItems } from "@/lib/db";
import type { SignOffStatus } from "@/types";

// GET /api/focus?status=PENDING_APPROVAL&isBlocker=true&teamName=Engineering

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") as SignOffStatus | null;
  const teamName = searchParams.get("teamName") ?? undefined;
  const isBlockerParam = searchParams.get("isBlocker");
  const isBlocker =
    isBlockerParam === "true" ? true : isBlockerParam === "false" ? false : undefined;

  try {
    const items = await getFocusItems({ status: status ?? undefined, teamName, isBlocker });
    return NextResponse.json(items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
