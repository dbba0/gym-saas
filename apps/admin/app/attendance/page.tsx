"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPost } from "../../lib/adminClient";

type AttendanceItem = {
  id: string;
  member?: { firstName: string; lastName: string } | null;
  checkedInAt: string;
};

const FALLBACK_ATTENDANCE: AttendanceItem[] = [
  {
    id: "1",
    member: { firstName: "Awa", lastName: "Diop" },
    checkedInAt: new Date().toISOString()
  }
];

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState("");

  const loadAttendance = () => {
    adminGet<AttendanceItem[]>("/attendance", FALLBACK_ATTENDANCE).then(setAttendance);
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const scanQr = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!qrToken.trim()) {
      setError("QR token is required.");
      return;
    }

    try {
      setSaving(true);
      const result = await adminPost<{ member?: { firstName: string; lastName: string } }>("/attendance/scan", {
        qrToken: qrToken.trim()
      });
      setSuccess(
        result.member ? `Checked in: ${result.member.firstName} ${result.member.lastName}` : "Attendance recorded."
      );
      setQrToken("");
      loadAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="/attendance" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Attendance</h1>
            <p className="subtitle">QR scans and check-ins</p>
          </div>
          <button className="btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Scan QR"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={scanQr}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>Scan member QR</h2>
            <input
              className="input"
              placeholder="Paste member qrToken"
              value={qrToken}
              onChange={(event) => setQrToken(event.target.value)}
            />
            {error && <p className="error-text">{error}</p>}
            {success && <p className="success-text">{success}</p>}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Scanning..." : "Confirm scan"}
              </button>
            </div>
          </form>
        )}

        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Checked in</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((item) => (
                <tr key={item.id}>
                  <td>{item.member ? `${item.member.firstName} ${item.member.lastName}` : "Member"}</td>
                  <td>{new Date(item.checkedInAt).toLocaleString()}</td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={2}>No attendance records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
