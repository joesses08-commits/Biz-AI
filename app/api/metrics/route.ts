import { NextResponse } from "next/server";
import { computeMetrics } from "@/lib/metrics";

export async function GET() {
  try {
    const metrics = await computeMetrics();
    if (!metrics) {
      return NextResponse.json({ error: "No data found. Please upload CSV files first." }, { status: 404 });
    }
    return NextResponse.json(metrics);
  } catch (err) {
    console.error("Metrics error:", err);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}
