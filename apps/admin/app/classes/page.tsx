"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPost } from "../../lib/adminClient";

type Coach = { id: string; name: string };
type ClassItem = {
  id: string;
  title: string;
  coach?: { id: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservations?: Array<{ id: string }>;
};

const FALLBACK_CLASSES: ClassItem[] = [
  {
    id: "1",
    title: "HIIT Power",
    coach: { id: "1", name: "Coach K" },
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    capacity: 18,
    reservations: [{ id: "r1" }, { id: "r2" }]
  }
];

function formatDateTimeLocal(isoDate: string) {
  const date = new Date(isoDate);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [coachId, setCoachId] = useState("");
  const [startsAt, setStartsAt] = useState(formatDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  const [endsAt, setEndsAt] = useState(formatDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()));
  const [capacity, setCapacity] = useState("20");

  const loadData = () => {
    Promise.all([adminGet<ClassItem[]>("/classes", FALLBACK_CLASSES), adminGet<Coach[]>("/coaches", [])]).then(
      ([classItems, coachItems]) => {
        setClasses(classItems);
        setCoaches(coachItems);
      }
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const capacityNum = Number.parseInt(capacity, 10);
    if (!title.trim() || !Number.isFinite(capacityNum) || capacityNum <= 0) {
      setError("Title and valid capacity are required.");
      return;
    }

    try {
      setSaving(true);
      await adminPost("/classes", {
        title: title.trim(),
        coachId: coachId || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        capacity: capacityNum
      });
      setTitle("");
      setCoachId("");
      setOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create class.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="/classes" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Classes</h1>
            <p className="subtitle">Bookings and schedules</p>
          </div>
          <button className="btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Create class"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={createClass}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>New class</h2>
            <input className="input" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
            <select className="input" value={coachId} onChange={(event) => setCoachId(event.target.value)}>
              <option value="">No coach</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
            <input
              className="input"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
            <input
              className="input"
              type="number"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="Capacity"
            />
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create class"}
              </button>
            </div>
          </form>
        )}

        <div className="list">
          {classes.map((item) => (
            <div key={item.id} className="list-item">
              <div>
                <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 6 }}>{item.title}</h3>
                <p className="subtitle">
                  Coach: {item.coach?.name || "-"} | Starts: {new Date(item.startsAt).toLocaleString()}
                </p>
              </div>
              <span className="badge">
                {item.reservations?.length || 0} / {item.capacity}
              </span>
            </div>
          ))}
          {classes.length === 0 && <div className="card">No classes yet.</div>}
        </div>
      </main>
    </div>
  );
}
