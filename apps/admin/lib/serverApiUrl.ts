function looksLocalhost(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function getServerApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error("Missing NEXT_PUBLIC_API_URL for admin server routes.");
  }

  const normalized = raw.replace(/\/$/, "");
  const isHttp = normalized.startsWith("http://") || normalized.startsWith("https://");
  if (!isHttp) {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute URL (http/https).");
  }

  if (process.env.NODE_ENV === "production" && looksLocalhost(normalized)) {
    throw new Error("NEXT_PUBLIC_API_URL cannot target localhost in production.");
  }

  return normalized;
}
