import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function forward(req: NextRequest, path: string[]) {
  if (!path?.length) {
    return NextResponse.json({ message: "Missing path" }, { status: 400 });
  }

  const query = req.nextUrl.search || "";
  const target = `${API_URL}/${path.join("/")}${query}`;
  const incomingAuth = req.headers.get("authorization");
  if (!incomingAuth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const headers: Record<string, string> = {};
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  headers.Authorization = incomingAuth;

  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();

  const response = await fetch(target, {
    method,
    headers,
    body
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json"
    }
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, path);
}
