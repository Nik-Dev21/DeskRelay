import { type NextRequest, NextResponse } from "next/server";
import { updateFocusItem } from "@/lib/db";
import { notifyManagerSignOff } from "@/lib/notifications";
import type { ManagerFocusItem } from "@/types";

// PATCH /api/focus/[id]
// Supports: inline text edits, sign-off toggle, status changes, deadline updates

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json()) as Partial<
    Pick<ManagerFocusItem, "checklistItem" | "contextSummary" | "targetDate" | "status" | "isSignedOff" | "teamName">
  >;

  try {
    const updated = await updateFocusItem(id, body);

    // When an executive signs off, notify the assigned manager via Slack
    if (body.isSignedOff === true) {
      notifyManagerSignOff({ ...updated, status: "SIGNED_OFF", isSignedOff: true }).catch((e) =>
        console.error("[focus] sign-off Slack notify failed:", e)
      );
    }

    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
