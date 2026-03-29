export type JwtPayload = {
  exp?: number;
  role?: "ADMIN" | "COACH" | "MEMBER";
};

export type ClientSession = {
  accessToken: string;
  refreshToken: string;
};

const ACCESS_TOKEN_KEY = "GYM_ADMIN_TOKEN";
const REFRESH_TOKEN_KEY = "GYM_ADMIN_REFRESH_TOKEN";

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return window.atob(padded);
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }
    return JSON.parse(decodeBase64Url(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 15) {
  const payload = decodeJwt(token);
  if (!payload?.exp) {
    return true;
  }
  return payload.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

export function readStoredSession(): ClientSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!accessToken || !refreshToken) {
      return null;
    }
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: ClientSession | null) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!session) {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  } catch {
    // Ignore storage restrictions in privacy mode.
  }
}
