import { isTokenExpired } from "./jwt";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

let token: string | null = null;
let authFailureHandler: ((reason: "expired" | "unauthorized") => void) | null = null;

export function setToken(value: string | null) {
  token = value;
}

export function setAuthFailureHandler(handler: ((reason: "expired" | "unauthorized") => void) | null) {
  authFailureHandler = handler;
}

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(method: ApiMethod, path: string, body?: unknown): Promise<T> {
  if (token && isTokenExpired(token)) {
    token = null;
    authFailureHandler?.("expired");
    throw new Error("Session expired. Please sign in again.");
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 || res.status === 403) {
    token = null;
    authFailureHandler?.("unauthorized");
    throw new Error("Session expired. Please sign in again.");
  }

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}
