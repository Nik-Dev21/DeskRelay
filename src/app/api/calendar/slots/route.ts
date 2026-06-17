import { type NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/graph";

// GET /api/calendar/slots?around=<ISO>&duration=<minutes>&email=<addr>
// Returns a 3-day window of slot availability centred on `around`.
// Used by the conflict resolution UI in the approval queue.

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const around = searchParams.get("around");
  const duration = parseInt(searchParams.get("duration") ?? "60", 10);
  const email = searchParams.get("email") ?? process.env.EXEC_EMAIL ?? "";

  if (!around) return NextResponse.json({ error: "around (ISO date) required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    const slots = await getAvailableSlots(email, around, duration);
    return NextResponse.json(slots);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
