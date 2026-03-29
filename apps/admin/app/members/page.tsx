"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPost } from "../../lib/adminClient";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  subscription?: { id: string; name: string } | null;
  activeSubscription?: { id: string; name: string } | null;
  subscriptionStatus?: "ACTIVE" | "EXPIRED" | "NONE";
  subscriptionExpiresAt?: string | null;
  coach?: { id: string; name: string } | null;
};

type Coach = { id: string; name: string };
type Subscription = { id: string; name: string; priceCents: number };

const FALLBACK_MEMBERS: Member[] = [
  {
    id: "1",
    firstName: "Awa",
    lastName: "Diop",
    phone: "+221111111111",
    subscription: { id: "s1", name: "Monthly" },
    activeSubscription: { id: "s1", name: "Monthly" },
    subscriptionStatus: "ACTIVE",
    subscriptionExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
    coach: { id: "c1", name: "Coach K" }
  }
];

function statusLabel(status?: Member["subscriptionStatus"]) {
  if (status === "ACTIVE") {
    return "ACTIVE";
  }
  if (status === "EXPIRED") {
    return "EXPIRED";
  }
  return "NONE";
}

function statusClass(status: string) {
  if (status === "ACTIVE") {
    return "badge-active";
  }
  if (status === "EXPIRED") {
    return "badge-expired";
  }
  return "badge-neutral";
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [coachId, setCoachId] = useState("");

  const loadData = () => {
    Promise.all([
      adminGet<Member[]>("/members", FALLBACK_MEMBERS),
      adminGet<Coach[]>("/coaches", []),
      adminGet<Subscription[]>("/subscriptions", [])
    ]).then(([memberItems, coachItems, subItems]) => {
      setMembers(memberItems);
      setCoaches(coachItems);
      setSubscriptions(subItems);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredMembers = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return members.filter((member) => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const matchesSearch =
        !searchLower ||
        fullName.includes(searchLower) ||
        (member.phone || "").toLowerCase().includes(searchLower);

      const memberSubId = member.activeSubscription?.id || member.subscription?.id || "";
      const matchesSubscription = !subscriptionFilter || memberSubId === subscriptionFilter;
      const matchesCoach = !coachFilter || member.coach?.id === coachFilter;
      const matchesStatus = !statusFilter || statusLabel(member.subscriptionStatus) === statusFilter;

      return matchesSearch && matchesSubscription && matchesCoach && matchesStatus;
    });
  }, [coachFilter, members, search, statusFilter, subscriptionFilter]);

  const createMember = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if ((email && !password) || (!email && password)) {
      setError("Email and password must be provided together.");
      return;
    }

    try {
      setSaving(true);
      await adminPost("/members", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        password: password || undefined,
        phone: phone.trim() || undefined,
        subscriptionId: subscriptionId || undefined,
        coachId: coachId || undefined
      });

      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setSubscriptionId("");
      setCoachId("");
      setOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create member.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="/members" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Members</h1>
            <p className="subtitle">Search, filter and renew subscriptions quickly</p>
          </div>
          <button className="btn" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Add member"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={createMember}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>New member</h2>
            <input
              className="input"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
            <input
              className="input"
              placeholder="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
            <input
              className="input"
              placeholder="Phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <input
              className="input"
              placeholder="Email (optional)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="input"
              placeholder="Password (optional)"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <select className="input" value={subscriptionId} onChange={(event) => setSubscriptionId(event.target.value)}>
              <option value="">No subscription</option>
              {subscriptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select className="input" value={coachId} onChange={(event) => setCoachId(event.target.value)}>
              <option value="">No coach</option>
              {coaches.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create member"}
              </button>
            </div>
          </form>
        )}

        <div className="card form-grid" style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>Search & filters</h2>
          <input
            className="input"
            placeholder="Search by name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" value={subscriptionFilter} onChange={(event) => setSubscriptionFilter(event.target.value)}>
            <option value="">All subscriptions</option>
            {subscriptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select className="input" value={coachFilter} onChange={(event) => setCoachFilter(event.target.value)}>
            <option value="">All coaches</option>
            {coaches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="EXPIRED">EXPIRED</option>
            <option value="NONE">NONE</option>
          </select>
        </div>

        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Subscription</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Coach</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => {
                const activeSub = member.activeSubscription || member.subscription;
                const subStatus = statusLabel(member.subscriptionStatus);
                return (
                  <tr key={member.id}>
                    <td>
                      {member.firstName} {member.lastName}
                    </td>
                    <td>{member.phone || "-"}</td>
                    <td>{activeSub?.name || "-"}</td>
                    <td>
                      <span className={`badge ${statusClass(subStatus)}`}>{subStatus}</span>
                    </td>
                    <td>
                      {member.subscriptionExpiresAt
                        ? new Date(member.subscriptionExpiresAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{member.coach?.name || "-"}</td>
                    <td>
                      <a
                        className="btn"
                        style={{ display: "inline-block", padding: "8px 12px", fontSize: 12 }}
                        href={`/payments?memberId=${member.id}&subscriptionId=${activeSub?.id || ""}`}
                      >
                        Quick renew
                      </a>
                    </td>
                  </tr>
                );
              })}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={7}>No members match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
