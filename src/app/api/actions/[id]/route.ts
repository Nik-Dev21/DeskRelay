import { type NextRequest, NextResponse } from "next/server";
import { getAction, updateActionStatus } from "@/lib/redis";
import { dispatchAction } from "@/lib/worker";
import type { ExtractedAction } from "@/types";

// PATCH /api/actions/[id]
// Body: { decision: "approved" | "rejected", overrides?: Partial<ExtractedAction> }
// Human-in-the-loop clearance endpoint — the approval queue POSTs here.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await req.json()) as {
    decision?: "approved" | "rejected";
    overrides?: Partial<ExtractedAction>;
  };

  const { decision, overrides } = body;
  if (!decision || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const action = await getAction(id);
  if (!action) return NextResponse.json({ error: "Action not found" }, { status: 404 });
  if (action.status !== "pending") {
    return NextResponse.json({ error: `Action already ${action.status}` }, { status: 409 });
  }

  const finalAction: ExtractedAction = { ...action, ...(overrides ?? {}) };

  if (decision === "rejected") {
    await updateActionStatus(id, "rejected");
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // Approved — dispatch asynchronously, return immediately
  await updateActionStatus(id, "approved");
  dispatchAction(id, finalAction).catch((err) =>
    console.error(`[actions] dispatch error for ${id}:`, err)
  );

  return NextResponse.json({ ok: true, status: "dispatched" });
}

// GET /api/actions/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const action = await getAction(id);
  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(action);
}
