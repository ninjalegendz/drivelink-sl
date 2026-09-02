import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { error: "The manual payment-slip workflow has been retired." },
    { status: 410 },
  );
}
