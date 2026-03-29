"use client";

import { decodeJwt, isTokenExpired, readStoredSession, writeStoredSession, type ClientSession } from "./session";

type AuthReason = "unauthorized" | "expired" | "forbidden";

type LoginPayload = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { role?: string };
};

let inMemorySession: ClientSession | null = null;
let refreshPromise: Promise<ClientSession | null> | null = null;

function getSession() {
  if (inMemorySession) {
    return inMemorySession;
  }
  const stored = readStoredSession();
  if (stored) {
    inMemorySession = stored;
  }
  return stored;
}

function setSession(session: ClientSession | null) {
  inMemorySession = session;
  writeStoredSession(session);
}

function redirectToLogin(reason: AuthReason) {
  if (typeof window === "undefined") {
    return;
  }
  const params = new URLSearchParams({ reason });
  const next = `/login?${params.toString()}`;
  if (window.location.pathname !== "/login") {
    window.location.href = next;
  } else if (window.location.search !== `?${params.toString()}`) {
    window.history.replaceState(null, "", next);
  }
}

async function refreshAccessToken(force = false) {
  const currentSession = getSession();
  if (!currentSession?.refreshToken) {
    return null;
  }

  if (!force && !isTokenExpired(currentSession.accessToken)) {
    return currentSession;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch("/api/public/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: currentSession.refreshToken })
        });
        const text = await response.text();
        let payload: LoginPayload | Record<string, unknown> | null = null;
        try {
          payload = text ? (JSON.parse(text) as LoginPayload | Record<string, unknown>) : null;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          return null;
        }

        const accessToken =
          typeof payload?.accessToken === "string"
            ? payload.accessToken
            : typeof payload?.token === "string"
              ? payload.token
              : null;
        const refreshToken = typeof payload?.refreshToken === "string" ? payload.refreshToken : null;
        if (!accessToken || !refreshToken) {
          return null;
        }

        const next = { accessToken, refreshToken };
        setSession(next);
        return next;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function fetchWithAuth(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  retried = false
) {
  let session = getSession();
  if (!session) {
    setSession(null);
    redirectToLogin("unauthorized");
    throw new Error("Unauthorized");
  }

  if (isTokenExpired(session.accessToken)) {
    const refreshed = await refreshAccessToken(true);
    if (!refreshed) {
      setSession(null);
      redirectToLogin("expired");
      throw new Error("Session expired. Please sign in again.");
    }
    session = refreshed;
  }

  const response = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if ((response.status === 401 || response.status === 403) && !retried) {
    const refreshed = await refreshAccessToken(true);
    if (refreshed) {
      return fetchWithAuth(method, path, body, true);
    }
    setSession(null);
    redirectToLogin(response.status === 403 ? "forbidden" : "expired");
    throw new Error("Session expired. Please sign in again.");
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as Record<string, unknown>).message)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function getClientToken() {
  return getSession()?.accessToken || null;
}

export function setClientToken(token: string | null) {
  if (!token) {
    setSession(null);
    return;
  }
  const previous = getSession();
  setSession({
    accessToken: token,
    refreshToken: previous?.refreshToken || ""
  });
}

export function getClientSession() {
  return getSession();
}

export function setClientSession(accessToken: string, refreshToken: string) {
  setSession({ accessToken, refreshToken });
}

export async function ensureAdminSession() {
  let session = getSession();
  if (!session) {
    return false;
  }

  if (!session.refreshToken) {
    setSession(null);
    return false;
  }

  if (isTokenExpired(session.accessToken)) {
    const refreshed = await refreshAccessToken(true);
    if (!refreshed) {
      setSession(null);
      return false;
    }
    session = refreshed;
  }

  const payload = decodeJwt(session.accessToken);
  if (payload?.role !== "ADMIN") {
    setSession(null);
    return false;
  }
  return true;
}

export async function logoutClient() {
  const session = getSession();
  if (session?.refreshToken) {
    try {
      await fetch("/api/public/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
    } catch {
      // ignore network errors while logging out
    }
  }
  setSession(null);
}

export async function adminGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return (await fetchWithAuth("GET", path)) as T;
  } catch (error) {
    if (error instanceof Error && /(Unauthorized|Session expired)/i.test(error.message)) {
      throw error;
    }
    return fallback;
  }
}

export async function adminPost<T>(path: string, body: unknown): Promise<T> {
  return (await fetchWithAuth("POST", path, body)) as T;
}

export async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  return (await fetchWithAuth("PATCH", path, body)) as T;
}

export async function adminDownload(path: string, fallbackFilename: string) {
  let session = getSession();
  if (!session) {
    redirectToLogin("unauthorized");
    throw new Error("Unauthorized");
  }
  if (isTokenExpired(session.accessToken)) {
    const refreshed = await refreshAccessToken(true);
    if (!refreshed) {
      setSession(null);
      redirectToLogin("expired");
      throw new Error("Session expired. Please sign in again.");
    }
    session = refreshed;
  }

  const response = await fetch(`/api/admin${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`
    }
  });

  if (response.status === 401 || response.status === 403) {
    setSession(null);
    redirectToLogin(response.status === 403 ? "forbidden" : "expired");
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
