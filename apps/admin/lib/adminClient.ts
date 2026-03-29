"use client";

import { isTokenExpired } from "./session";

let inMemoryToken: string | null = null;

export function getClientToken() {
  if (inMemoryToken) {
    return inMemoryToken;
  }
  if (typeof window === "undefined") {
    return inMemoryToken;
  }
  try {
    const token = window.localStorage.getItem("GYM_ADMIN_TOKEN");
    if (token) {
      inMemoryToken = token;
    }
    return token;
  } catch {
    return inMemoryToken;
  }
}

export function setClientToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!token) {
      window.localStorage.removeItem("GYM_ADMIN_TOKEN");
      return;
    }
    window.localStorage.setItem("GYM_ADMIN_TOKEN", token);
  } catch {
    // Ignore storage failures (private mode / restricted environments).
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

function getValidToken() {
  const token = getClientToken();
  if (!token) {
    setClientToken(null);
    redirectToLogin();
    throw new Error("Unauthorized");
  }

  if (isTokenExpired(token)) {
    setClientToken(null);
    redirectToLogin();
    throw new Error("Session expired. Please sign in again.");
  }

  return token;
}

async function request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown) {
  const token = getValidToken();
  const response = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (response.status === 401 || response.status === 403) {
    setClientToken(null);
    redirectToLogin();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as Record<string, unknown>).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function adminGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>("GET", path);
  } catch (error) {
    if (error instanceof Error && /(Unauthorized|Session expired)/i.test(error.message)) {
      throw error;
    }
    return fallback;
  }
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export async function adminDownload(path: string, fallbackFilename: string) {
  const token = getValidToken();
  const response = await fetch(`/api/admin${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    setClientToken(null);
    redirectToLogin();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename=\"?([^"]+)\"?/i);
  const filename = filenameMatch?.[1] || fallbackFilename;

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
