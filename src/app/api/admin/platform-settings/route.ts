import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { error: "Manual bank-transfer payment settings have been retired." },
    { status: 410 },
  );
}
