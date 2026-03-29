"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ensureAdminSession, getClientSession, logoutClient } from "../lib/adminClient";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const isPublicPath = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (isPublicPath) {
      setReady(true);
      return;
    }
    setReady(false);

    const verify = async () => {
      const hadSession = Boolean(getClientSession());
      const ok = await ensureAdminSession();
      if (!ok) {
        await logoutClient();
        router.replace(`/login?reason=${hadSession ? "expired" : "unauthorized"}`);
        return;
      }
      setReady(true);
    };

    verify();
    const timer = setInterval(() => {
      verify();
    }, 30000);
    return () => clearInterval(timer);
  }, [isPublicPath, pathname, router]);

  if (!isPublicPath && !ready) {
    return (
      <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p style={{ color: "#5a5f6c" }}>Checking admin session...</p>
      </main>
    );
  }

  return <>{children}</>;
}
