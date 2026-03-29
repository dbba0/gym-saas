import { NextRequest, NextResponse } from "next/server";
import { getServerApiUrl } from "../../../../lib/serverApiUrl";

async function fetchJson(path: string, authorization: string) {
  const API_URL = getServerApiUrl();
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: { Authorization: authorization }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return response.json();
}

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [stats, payments] = await Promise.all([
      fetchJson("/stats", authorization),
      fetchJson("/payments", authorization)
    ]);
    const payload = {
      generatedAt: new Date().toISOString(),
      stats,
      payments
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=\"gym-report-${new Date().toISOString().slice(0, 10)}.json\"`
      }
    });
  } catch (error) {
    return NextResponse.json({ message: "Failed to generate report" }, { status: 500 });
  }
}
