import { isTokenExpired } from "./jwt";

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim()?.replace(/\/$/, "");
if (!API_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_URL. Set it in apps/mobile/.env or your EAS environment.");
}

let accessToken: string | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;
let authFailureHandler: ((reason: "expired" | "unauthorized") => void) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function getApiBaseUrl() {
  return API_URL;
}

export function setToken(value: string | null) {
  accessToken = value;
}

export function setSessionRefreshHandler(handler: (() => Promise<boolean>) | null) {
  refreshHandler = handler;
}

export function setAuthFailureHandler(handler: ((reason: "expired" | "unauthorized") => void) | null) {
  authFailureHandler = handler;
}

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

async function refreshAccessToken() {
  if (!refreshHandler) {
    return false;
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshHandler().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function ensureActiveAccessToken() {
  if (!accessToken) {
    return false;
  }
  if (!isTokenExpired(accessToken)) {
    return true;
  }
  const refreshed = await refreshAccessToken();
  return refreshed && Boolean(accessToken) && !isTokenExpired(accessToken);
}

async function request<T>(method: ApiMethod, path: string, body?: unknown, retried = false): Promise<T> {
  const hasActiveToken = await ensureActiveAccessToken();
  if (!hasActiveToken && accessToken) {
    accessToken = null;
    authFailureHandler?.("expired");
    throw new Error("Session expired. Please sign in again.");
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if ((res.status === 401 || res.status === 403) && !retried && refreshHandler) {
    const refreshed = await refreshAccessToken();
    if (refreshed && accessToken) {
      return request<T>(method, path, body, true);
    }
  }

  if (res.status === 401 || res.status === 403) {
    accessToken = null;
    authFailureHandler?.(res.status === 401 ? "expired" : "unauthorized");
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
