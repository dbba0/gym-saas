"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPost } from "../../lib/adminClient";

type Coach = {
  id: string;
  name: string;
  speciality?: string | null;
  members?: Array<{ id: string }>;
};

const FALLBACK_COACHES: Coach[] = [{ id: "1", name: "Coach K", speciality: "Strength", members: [{ id: "1" }] }];

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loadCoaches = () => {
    adminGet<Coach[]>("/coaches", FALLBACK_COACHES).then(setCoaches);
  };

  useEffect(() => {
    loadCoaches();
  }, []);

  const createCoach = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Coach name is required.");
      return;
    }
    if ((email && !password) || (!email && password)) {
      setError("Email and password must be provided together.");
      return;
    }

    try {
      setSaving(true);
      await adminPost("/coaches", {
        name: name.trim(),
        speciality: speciality.trim() || undefined,
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        password: password || undefined
      });
      setName("");
      setSpeciality("");
      setBio("");
      setEmail("");
      setPassword("");
      setOpen(false);
      loadCoaches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create coach.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="/coaches" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Coaches</h1>
            <p className="subtitle">Specialists and assigned members</p>
          </div>
          <button className="btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "Add coach"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={createCoach}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>New coach</h2>
            <input className="input" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <input
              className="input"
              placeholder="Speciality"
              value={speciality}
              onChange={(event) => setSpeciality(event.target.value)}
            />
            <input className="input" placeholder="Bio" value={bio} onChange={(event) => setBio(event.target.value)} />
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
            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create coach"}
              </button>
            </div>
          </form>
        )}

        <div className="grid-2">
          {coaches.map((coach) => (
            <div key={coach.id} className="card">
              <h2 style={{ fontFamily: "var(--font-head)", marginBottom: 6 }}>{coach.name}</h2>
              <p className="subtitle">{coach.speciality || "General"}</p>
              <div style={{ marginTop: 14 }}>
                <span className="badge">{coach.members?.length || 0} members</span>
              </div>
            </div>
          ))}
          {coaches.length === 0 && <div className="card">No coaches yet.</div>}
        </div>
      </main>
    </div>
  );
}
