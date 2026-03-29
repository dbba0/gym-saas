type JwtPayload = {
  exp?: number;
};

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }
  return null;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }
    const decoded = decodeBase64Url(payload);
    if (!decoded) {
      return null;
    }
    return JSON.parse(decoded) as JwtPayload;
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
