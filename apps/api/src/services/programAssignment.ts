import { prisma } from "../lib/prisma";

type AssignableMemberItem = {
  id: string;
  firstName: string;
  lastName: string;
  isAssigned: boolean;
  sessionsDone: number;
  startedAt: string | null;
  statusLabel: string;
};

export type ProgramAssignableMembersResponse = {
  programId: string;
  assignedMemberId: string | null;
  members: AssignableMemberItem[];
};

export async function getProgramAssignableMembers(
  gymId: string,
  programId: string,
  allowedCoachId: string | null
): Promise<ProgramAssignableMembersResponse | null> {
  const program = await prisma.program.findFirst({
    where: { id: programId, gymId },
    select: { id: true, memberId: true, coachId: true, isPublic: true }
  });

  if (!program) {
    return null;
  }

  if (allowedCoachId && program.coachId !== allowedCoachId && !program.isPublic) {
    return null;
  }

  const members = await prisma.member.findMany({
    where: {
      gymId,
      ...(allowedCoachId ? { coachId: allowedCoachId } : {})
    },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
  });

  const progressByMemberRaw = await prisma.attendance.groupBy({
    by: ["memberId"],
    where: {
      programId: program.id,
      source: "MANUAL",
      memberId: { in: members.map((member) => member.id) }
    },
    _count: { _all: true },
    _min: { checkedInAt: true }
  });

  const progressByMember = new Map(
    progressByMemberRaw.map((row) => [
      row.memberId,
      {
        sessionsDone: row._count._all,
        startedAt: row._min.checkedInAt ? row._min.checkedInAt.toISOString() : null
      }
    ])
  );

  const items: AssignableMemberItem[] = members.map((member) => {
    const progress = progressByMember.get(member.id);
    const isAssigned = program.memberId === member.id;
    const sessionsDone = progress?.sessionsDone || 0;
    const startedAt = progress?.startedAt || null;
    const statusLabel = isAssigned
      ? "Programme assigné"
      : sessionsDone > 0
        ? `En cours (${sessionsDone} séance${sessionsDone > 1 ? "s" : ""})`
        : "Aucun programme actif";

    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      isAssigned,
      sessionsDone,
      startedAt,
      statusLabel
    };
  });

  return {
    programId: program.id,
    assignedMemberId: program.memberId,
    members: items
  };
}
