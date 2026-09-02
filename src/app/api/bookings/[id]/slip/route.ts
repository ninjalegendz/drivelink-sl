import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { error: "Manual bank-slip payments are no longer supported." },
    { status: 410 },
  );
}
