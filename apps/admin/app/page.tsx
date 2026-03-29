"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { adminDownload, adminGet } from "../lib/adminClient";

type AttendancePoint = { date: string; label: string; count: number };
type WeeklyPoint = { weekStart: string; label: string; count: number };
type RevenuePoint = { month: string; label: string; valueCents: number };
type MemberGrowthPoint = { month: string; label: string; totalMembers: number; newMembers: number };

type StatsPayload = {
  memberCount: number;
  coachCount: number;
  monthlyRevenueCents: number;
  attendanceCount: number;
  activeMembersCount: number;
  todayAttendanceCount: number;
  todayBookingsCount: number;
  todayClassesCount: number;
  alerts: {
    expiredMemberships: number;
    overduePayments: number;
    fullClassesToday: number;
  };
  attendance: {
    totalCount: number;
    daily: AttendancePoint[];
    weekly: WeeklyPoint[];
  };
  trends: {
    revenue: RevenuePoint[];
    members: MemberGrowthPoint[];
  };
};

type Payment = {
  id: string;
  amountCents: number;
  method: string;
  paidAt: string;
  subscription?: { name: string } | null;
  member?: { firstName: string; lastName: string } | null;
};

const EMPTY_STATS: StatsPayload = {
  memberCount: 0,
  coachCount: 0,
  monthlyRevenueCents: 0,
  attendanceCount: 0,
  activeMembersCount: 0,
  todayAttendanceCount: 0,
  todayBookingsCount: 0,
  todayClassesCount: 0,
  alerts: {
    expiredMemberships: 0,
    overduePayments: 0,
    fullClassesToday: 0
  },
  attendance: {
    totalCount: 0,
    daily: [],
    weekly: []
  },
  trends: {
    revenue: [],
    members: []
  }
};

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsPayload>(EMPTY_STATS);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, paymentData] = await Promise.all([
        adminGet<StatsPayload>("/stats", EMPTY_STATS),
        adminGet<Payment[]>("/payments", [])
      ]);
      setStats(statsData);
      setPayments(paymentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const exportReport = async () => {
    try {
      setDownloading(true);
      await adminDownload("/report", `gym-report-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setDownloading(false);
    }
  };

  const dailyAttendance = stats.attendance?.daily || [];
  const weeklyAttendance = stats.attendance?.weekly || [];
  const revenueTrend = stats.trends?.revenue || [];
  const membersTrend = stats.trends?.members || [];

  const dailyMax = Math.max(1, ...dailyAttendance.map((point) => point.count || 0));
  const weeklyMax = Math.max(1, ...weeklyAttendance.map((point) => point.count || 0));
  const revenueMax = Math.max(1, ...revenueTrend.map((point) => point.valueCents || 0));
  const membersMax = Math.max(1, ...membersTrend.map((point) => point.totalMembers || 0));

  const alerts = useMemo(
    () => [
      {
        key: "expired",
        count: stats.alerts?.expiredMemberships || 0,
        label: "memberships expired"
      },
      {
        key: "overdue",
        count: stats.alerts?.overduePayments || 0,
        label: "payments overdue"
      },
      {
        key: "full",
        count: stats.alerts?.fullClassesToday || 0,
        label: "classes full today"
      }
    ],
    [stats.alerts]
  );

  return (
    <div className="app-shell">
      <Sidebar active="/" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Dashboard</h1>
            <p className="subtitle">Live control center for your gym operations</p>
          </div>
          <button className="btn" onClick={exportReport} disabled={downloading}>
            {downloading ? "Generating..." : "Create report"}
          </button>
        </div>

        {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
        {loading && <p className="subtitle" style={{ marginBottom: 12 }}>Loading dashboard...</p>}

        <div className="hero">
          <h2>Today snapshot</h2>
          <p>
            {stats.todayClassesCount} classes scheduled, {stats.todayBookingsCount} bookings and{" "}
            {stats.todayAttendanceCount} check-ins.
          </p>
        </div>

        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="card stat">
            <span>Active members</span>
            <h3>{stats.activeMembersCount}</h3>
          </div>
          <div className="card stat">
            <span>Revenue this month</span>
            <h3>{(stats.monthlyRevenueCents / 100).toFixed(2)} XOF</h3>
          </div>
          <div className="card stat">
            <span>Bookings today</span>
            <h3>{stats.todayBookingsCount}</h3>
          </div>
          <div className="card stat">
            <span>Attendance today</span>
            <h3>{stats.todayAttendanceCount}</h3>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="topbar" style={{ marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22 }}>Important alerts</h2>
            <span className="badge">Real-time</span>
          </div>
          <div className="list">
            {alerts.map((alert) => (
              <div key={alert.key} className="list-item">
                <strong>{alert.count > 0 ? "Warning" : "OK"}</strong>
                <span>
                  {alert.count} {alert.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="topbar" style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22 }}>Attendance (7 days)</h2>
              <span className="badge">Daily</span>
            </div>
            <div className="trend-grid">
              {dailyAttendance.map((point) => (
                <div key={point.date} className="trend-col" title={`${point.count} check-ins`}>
                  <div
                    className="trend-bar daily"
                    style={{ height: `${Math.max(8, Math.round((point.count / dailyMax) * 120))}px` }}
                  />
                  <span className="trend-value">{point.count}</span>
                  <span className="trend-label">{point.label}</span>
                </div>
              ))}
              {dailyAttendance.length === 0 && <p className="subtitle">No attendance data yet.</p>}
            </div>
          </div>

          <div className="card">
            <div className="topbar" style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22 }}>Revenue (6 months)</h2>
              <span className="badge">Monthly</span>
            </div>
            <div className="trend-grid">
              {revenueTrend.map((point) => (
                <div key={point.month} className="trend-col" title={`${(point.valueCents / 100).toFixed(2)} XOF`}>
                  <div
                    className="trend-bar weekly"
                    style={{ height: `${Math.max(8, Math.round((point.valueCents / revenueMax) * 120))}px` }}
                  />
                  <span className="trend-value">{(point.valueCents / 100).toFixed(0)}</span>
                  <span className="trend-label">{point.label}</span>
                </div>
              ))}
              {revenueTrend.length === 0 && <p className="subtitle">No revenue trend data yet.</p>}
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="topbar" style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22 }}>Members growth</h2>
              <span className="badge">Monthly</span>
            </div>
            <div className="trend-grid">
              {membersTrend.map((point) => (
                <div
                  key={point.month}
                  className="trend-col"
                  title={`${point.totalMembers} members (${point.newMembers} new)`}
                >
                  <div
                    className="trend-bar daily"
                    style={{ height: `${Math.max(8, Math.round((point.totalMembers / membersMax) * 120))}px` }}
                  />
                  <span className="trend-value">{point.totalMembers}</span>
                  <span className="trend-label">{point.label}</span>
                </div>
              ))}
              {membersTrend.length === 0 && <p className="subtitle">No members trend data yet.</p>}
            </div>
          </div>

          <div className="card">
            <div className="topbar" style={{ marginBottom: 12 }}>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22 }}>Attendance (8 weeks)</h2>
              <span className="badge">Weekly</span>
            </div>
            <div className="trend-grid">
              {weeklyAttendance.map((point) => (
                <div key={point.weekStart} className="trend-col" title={`${point.count} check-ins`}>
                  <div
                    className="trend-bar weekly"
                    style={{ height: `${Math.max(8, Math.round((point.count / weeklyMax) * 120))}px` }}
                  />
                  <span className="trend-value">{point.count}</span>
                  <span className="trend-label">{point.label}</span>
                </div>
              ))}
              {weeklyAttendance.length === 0 && <p className="subtitle">No attendance data yet.</p>}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="topbar" style={{ marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 22 }}>Recent payments</h2>
            <span className="badge">Last 30 days</span>
          </div>
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
              {payments.slice(0, 6).map((payment) => (
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
