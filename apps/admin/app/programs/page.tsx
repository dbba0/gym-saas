"use client";

import { FormEvent, useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import { adminGet, adminPatch, adminPost } from "../../lib/adminClient";

type Program = {
  id: string;
  title: string;
  coach?: { name: string } | null;
  member?: { id: string; firstName: string; lastName: string } | null;
  exercises?: Array<{ id: string; name: string }>;
};

type Member = { id: string; firstName: string; lastName: string };

const FALLBACK_PROGRAMS: Program[] = [
  {
    id: "1",
    title: "Strength Starter",
    coach: { name: "Coach K" },
    member: { id: "m1", firstName: "Awa", lastName: "Diop" },
    exercises: [{ id: "e1", name: "Squat" }, { id: "e2", name: "Bench" }]
  }
];

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assigningProgramId, setAssigningProgramId] = useState<string | null>(null);
  const [assignmentByProgram, setAssignmentByProgram] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberId, setMemberId] = useState("");

  const loadData = async () => {
    const [programItems, memberItems] = await Promise.all([
      adminGet<Program[]>("/programs", FALLBACK_PROGRAMS),
      adminGet<Member[]>("/members", [])
    ]);
    setPrograms(programItems);
    setMembers(memberItems);
    setAssignmentByProgram(
      programItems.reduce<Record<string, string>>((acc, program) => {
        acc[program.id] = program.member?.id ?? "";
        return acc;
      }, {})
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const createProgram = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!title.trim()) {
      setError("Program title is required.");
      return;
    }

    try {
      setSaving(true);
      await adminPost("/programs", {
        title: title.trim(),
        description: description.trim() || undefined,
        memberId: memberId || undefined
      });
      setTitle("");
      setDescription("");
      setMemberId("");
      setOpen(false);
      setSuccess("Program created.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create program.");
    } finally {
      setSaving(false);
    }
  };

  const assignMember = async (programId: string) => {
    setError(null);
    setSuccess(null);
    try {
      setAssigningProgramId(programId);
      await adminPatch(`/programs/${programId}/assign`, {
        memberId: assignmentByProgram[programId] || null
      });
      setSuccess("Program assignment updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update program assignment.");
    } finally {
      setAssigningProgramId(null);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="/programs" />
      <main className="content">
        <div className="topbar">
          <div>
            <h1 className="title">Programs</h1>
            <p className="subtitle">Training plans created by coaches</p>
          </div>
          <button className="btn" onClick={() => setOpen((value) => !value)}>
            {open ? "Close" : "New program"}
          </button>
        </div>

        {open && (
          <form className="card form-grid" onSubmit={createProgram}>
            <h2 style={{ fontFamily: "var(--font-head)", fontSize: 24 }}>New program</h2>
            <input
              className="input"
              placeholder="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              className="input"
              placeholder="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <select className="input" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
              <option value="">No member assigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Create program"}
              </button>
            </div>
          </form>
        )}
        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}

        <div className="list">
          {programs.map((program) => (
            <div key={program.id} className="list-item">
              <div>
                <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 6 }}>{program.title}</h3>
                <p className="subtitle">
                  Coach: {program.coach?.name || "-"} | Member:{" "}
                  {program.member ? `${program.member.firstName} ${program.member.lastName}` : "-"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span className="badge">{program.exercises?.length || 0} exercises</span>
                <select
                  className="input"
                  style={{ width: 220, maxWidth: "100%" }}
                  value={assignmentByProgram[program.id] ?? ""}
                  onChange={(event) =>
                    setAssignmentByProgram((current) => ({
                      ...current,
                      [program.id]: event.target.value
                    }))
                  }
                >
                  <option value="">No member assigned</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName}
                    </option>
                  ))}
                </select>
                <button
                  className="btn"
                  type="button"
                  disabled={assigningProgramId === program.id}
                  onClick={() => assignMember(program.id)}
                >
                  {assigningProgramId === program.id ? "Saving..." : "Assign"}
                </button>
              </div>
            </div>
          ))}
          {programs.length === 0 && <div className="card">No programs yet.</div>}
        </div>
      </main>
    </div>
  );
}
