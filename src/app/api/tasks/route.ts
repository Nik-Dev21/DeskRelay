import { type NextRequest, NextResponse } from "next/server";
import { getTaskItems } from "@/lib/db";
import type { TaskStatus } from "@/types";

// GET /api/tasks?assignedTo=Alex&status=TODO&priority=HIGH

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const assignedTo = searchParams.get("assignedTo") ?? undefined;
  const status = searchParams.get("status") as TaskStatus | null;
  const priority = searchParams.get("priority") as "HIGH" | "MEDIUM" | "LOW" | null;

  try {
    const items = await getTaskItems({
      assignedTo,
      status: status ?? undefined,
      priority: priority ?? undefined,
    });
    return NextResponse.json(items);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
