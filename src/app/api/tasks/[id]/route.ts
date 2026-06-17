import { type NextRequest, NextResponse } from "next/server";
import { updateTaskItem } from "@/lib/db";
import type { EmployeeActionItem } from "@/types";

// PATCH /api/tasks/[id]
// Used by both the executive widget (re-assign, deadline change) and
// employee self-service (status update: TODO → IN_PROGRESS → DONE)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json()) as Partial<
    Pick<EmployeeActionItem, "taskName" | "taskDetails" | "status" | "priority" | "deadline">
  >;

  try {
    const updated = await updateTaskItem(id, body);
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
