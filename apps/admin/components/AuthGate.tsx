"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getClientToken, setClientToken } from "../lib/adminClient";
import { isTokenExpired } from "../lib/session";

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

    const verify = () => {
      const token = getClientToken();
      if (!token || isTokenExpired(token)) {
        setClientToken(null);
        router.replace("/login");
        return false;
      }
      setReady(true);
      return true;
    };

    if (!verify()) {
      return;
    }

    const timer = setInterval(verify, 30000);
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
