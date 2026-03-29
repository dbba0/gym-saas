"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPost } from "../../lib/adminClient";

type Subscription = {
  id: string;
  name: string;
  priceCents: number;
  durationMonths: number;
};

type MemberSummary = {
  id: string;
  activeSubscription?: { id: string; name: string } | null;
  subscription?: { id: string; name: string } | null;
  subscriptionStatus?: "ACTIVE" | "EXPIRED" | "NONE";
};

const FALLBACK_SUBS: Subscription[] = [
  { id: "1", name: "Monthly", priceCents: 20000, durationMonths: 1 },
  { id: "2", name: "Quarterly", priceCents: 54000, durationMonths: 3 }
];

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [priceCents, setPriceCents] = useState("20000");
  const [durationMonths, setDurationMonths] = useState("1");

  const loadSubs = () => {
    Promise.all([
      adminGet<Subscription[]>("/subscriptions", FALLBACK_SUBS),
      adminGet<MemberSummary[]>("/members", [])
    ]).then(([subscriptionItems, memberItems]) => {
      setSubscriptions(subscriptionItems);
      setMembers(memberItems);
    });
  };

  useEffect(() => {
    loadSubs();
  }, []);

  const createPlan = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const price = Number.parseInt(priceCents, 10);
    const duration = Number.parseInt(durationMonths, 10);
    if (!name.trim() || !Number.isFinite(price) || !Number.isFinite(duration) || price <= 0 || duration <= 0) {
      setError("Provide valid plan name, price and duration.");
      return;
    }

    try {
      setSaving(true);
      await adminPost("/subscriptions", {
        name: name.trim(),
        priceCents: price,
        durationMonths: duration
      });
      setName("");
      setPriceCents("20000");
      setDurationMonths("1");
      setOpen(false);
      loadSubs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan.");
    } finally {
      setSaving(false);
    }
  };

  const usageByPlan = subscriptions.reduce<Record<string, { active: number; expired: number }>>((acc, plan) => {
    acc[plan.id] = { active: 0, expired: 0 };
    return acc;
  }, {});

  for (const member of members) {
    const planId = member.activeSubscription?.id || member.subscription?.id;
    if (!planId || !usageByPlan[planId]) {
      continue;
    }
    if (member.subscriptionStatus === "ACTIVE") {
      usageByPlan[planId].active += 1;
    } else if (member.subscriptionStatus === "EXPIRED") {
      usageByPlan[planId].expired += 1;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active="/subscriptions" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Subscriptions</h1>
            <p className="subtitle">Plan pricing and durations</p>
          </div>
          <button className="btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Create plan"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={createPlan}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>New plan</h2>
            <input className="input" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <input
              className="input"
              type="number"
              placeholder="Price (cents)"
              value={priceCents}
              onChange={(event) => setPriceCents(event.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="Duration (months)"
              value={durationMonths}
              onChange={(event) => setDurationMonths(event.target.value)}
            />
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create plan"}
              </button>
            </div>
          </form>
        )}

        <div className="grid-2">
          {subscriptions.map((plan) => (
            <div key={plan.id} className="card">
              <h2 style={{ fontFamily: "var(--font-head)", marginBottom: 8 }}>{plan.name}</h2>
              <p className="subtitle">{plan.durationMonths} months</p>
              <div style={{ marginTop: 14, fontSize: 22, fontWeight: 600 }}>
                {(plan.priceCents / 100).toFixed(2)} XOF
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <span className="badge badge-active">ACTIVE {usageByPlan[plan.id]?.active || 0}</span>
                <span className="badge badge-expired">EXPIRED {usageByPlan[plan.id]?.expired || 0}</span>
              </div>
            </div>
          ))}
          {subscriptions.length === 0 && <div className="card">No plans yet.</div>}
        </div>
      </main>
    </div>
  );
}
