"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { setClientToken } from "../lib/adminClient";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/coaches", label: "Coaches" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/programs", label: "Programs" },
  { href: "/payments", label: "Payments" },
  { href: "/attendance", label: "Attendance" },
  { href: "/classes", label: "Classes" }
];

export default function Sidebar({ active }: { active: string }) {
  const router = useRouter();

  const logout = () => {
    setClientToken(null);
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div>
        <div className="brand">Atlas Gym</div>
        <p className="subtitle">Operations console</p>
      </div>
      <nav className="nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            className={active === item.href ? "active" : ""}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="card" style={{ background: "#1a1f2d", color: "#f7f4ee" }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Active Plan</p>
        <p style={{ fontSize: 13 }}>SaaS Monthly</p>
        <p style={{ marginTop: 12, fontSize: 12, color: "#9aa3b2" }}>Renewal: 2026-04-12</p>
      </div>
      <button type="button" className="sidebar-logout" onClick={logout}>
        Logout
      </button>
    </aside>
  );
}
