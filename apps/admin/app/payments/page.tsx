"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPost } from "../../lib/adminClient";

type Payment = {
  id: string;
  member?: { id: string; firstName: string; lastName: string } | null;
  subscription?: { id: string; name: string } | null;
  amountCents: number;
  method: "WAVE" | "ORANGE_MONEY" | "FREE_MONEY" | "MOBILE_MONEY" | "CARD" | "CASH";
  paidAt: string;
};

type Member = { id: string; firstName: string; lastName: string };
type Subscription = { id: string; name: string; priceCents: number };

const FALLBACK_PAYMENTS: Payment[] = [
  {
    id: "1",
    member: { id: "m1", firstName: "Awa", lastName: "Diop" },
    subscription: { id: "s1", name: "Monthly" },
    amountCents: 20000,
    method: "MOBILE_MONEY",
    paidAt: new Date().toISOString()
  }
];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const [memberId, setMemberId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [amountCents, setAmountCents] = useState("20000");
  const [method, setMethod] = useState<Payment["method"]>("WAVE");

  const loadData = () => {
    Promise.all([
      adminGet<Payment[]>("/payments", FALLBACK_PAYMENTS),
      adminGet<Member[]>("/members", []),
      adminGet<Subscription[]>("/subscriptions", [])
    ]).then(([paymentItems, memberItems, subItems]) => {
      setPayments(paymentItems);
      setMembers(memberItems);
      setSubscriptions(subItems);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const queryMemberId = params.get("memberId") || "";
    const querySubscriptionId = params.get("subscriptionId") || "";
    if (!queryMemberId && !querySubscriptionId) {
      return;
    }
    setOpen(true);
    if (queryMemberId) {
      setMemberId(queryMemberId);
    }
    if (querySubscriptionId) {
      setSubscriptionId(querySubscriptionId);
    }
  }, []);

  useEffect(() => {
    if (!subscriptionId) {
      return;
    }
    const selected = subscriptions.find((item) => item.id === subscriptionId);
    if (!selected) {
      return;
    }
    setAmountCents(String(selected.priceCents));
  }, [subscriptionId, subscriptions]);

  const recordPayment = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setCheckoutUrl(null);
    const amount = Number.parseInt(amountCents, 10);
    if (!memberId || !Number.isFinite(amount) || amount <= 0) {
      setError("Member and amount are required.");
      return;
    }
    if ((method === "WAVE" || method === "ORANGE_MONEY" || method === "FREE_MONEY") && !subscriptionId) {
      setError("A subscription is required to create a mobile money payment link.");
      return;
    }

    try {
      setSaving(true);
      if (method === "WAVE" || method === "ORANGE_MONEY" || method === "FREE_MONEY") {
        const intent = await adminPost<{
          id: string;
          status: string;
          checkoutUrl: string;
        }>("/payments/intents", {
          memberId,
          subscriptionId,
          amountCents: amount,
          method
        });
        setCheckoutUrl(intent.checkoutUrl);
      } else {
        await adminPost("/payments", {
          memberId,
          subscriptionId: subscriptionId || undefined,
          amountCents: amount,
          method
        });
        setOpen(false);
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="/payments" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Payments</h1>
            <p className="subtitle">Transactions and renewals</p>
          </div>
          <button className="btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Record payment"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={recordPayment}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>Record payment</h2>
            <select className="input" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={subscriptionId}
              onChange={(event) => setSubscriptionId(event.target.value)}
            >
              <option value="">No plan</option>
              {subscriptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              value={amountCents}
              onChange={(event) => setAmountCents(event.target.value)}
              placeholder="Amount in cents"
            />
            <select
              className="input"
              value={method}
              onChange={(event) => setMethod(event.target.value as Payment["method"])}
            >
              <option value="WAVE">WAVE</option>
              <option value="ORANGE_MONEY">ORANGE_MONEY</option>
              <option value="FREE_MONEY">FREE_MONEY</option>
              <option value="CARD">CARD</option>
              <option value="MOBILE_MONEY">MOBILE_MONEY</option>
              <option value="CASH">CASH</option>
            </select>
            {error && <p className="error-text">{error}</p>}
            {checkoutUrl && (
              <p className="success-text">
                Payment link ready:{" "}
                <a href={checkoutUrl} target="_blank" rel="noreferrer">
                  open checkout
                </a>
              </p>
            )}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : method === "CARD" || method === "CASH" ? "Save payment" : "Create payment link"}
              </button>
            </div>
          </form>
        )}

        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.member ? `${payment.member.firstName} ${payment.member.lastName}` : "Member"}</td>
                  <td>{payment.subscription?.name || "Plan"}</td>
                  <td>{(payment.amountCents / 100).toFixed(2)} XOF</td>
                  <td>{payment.method}</td>
                  <td>{new Date(payment.paidAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={5}>No payments yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
