import { NextRequest, NextResponse } from "next/server";
import { getServerApiUrl } from "../../../../lib/serverApiUrl";

export async function POST(req: NextRequest) {
  try {
    const API_URL = getServerApiUrl();
    const body = await req.text();
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json"
      }
    });
  } catch {
    return NextResponse.json({ message: "Failed to reach API" }, { status: 502 });
  }
}
