import { NextResponse } from "next/server";

// The old manual NIC + selfie upload was replaced by Didit's identity and
// liveness flow. Keep a deliberate 410 response for stale installed clients
// instead of accepting identity files through an unmonitored legacy path.
export async function POST() {
  return NextResponse.json(
    {
      error: "This verification method is no longer available. Open Account and use Verify identity.",
      code: "verification_method_retired",
    },
    { status: 410 },
  );
}
