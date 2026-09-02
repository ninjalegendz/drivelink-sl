import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json(
    { error: "Rental Pages are not charged per-booking platform fees." },
    { status: 410 },
  );
}
