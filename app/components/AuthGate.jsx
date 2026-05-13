"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "./AppShell";

const PUBLIC_ROUTES = ["/login", "/subscription/unsubscribe"];

function isPublic(pathname) {
  if (!pathname) return false;
  return PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

export default function AuthGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && sessionStorage.getItem("email_auth") === "true";
    setAuthenticated(ok);
    setChecked(true);

    if (!ok && !isPublic(pathname)) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [pathname, router]);

  if (isPublic(pathname)) {
    return children;
  }

  if (!checked) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748B",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
