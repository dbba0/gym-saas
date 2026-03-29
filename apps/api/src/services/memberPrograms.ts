import { prisma } from "../lib/prisma";

type ProgramProgression = {
  sessionsDone: number;
  completionPercent: number | null;
};

type ProgramCompletionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

type MemberProgramItem = {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  isAssigned: boolean;
  startedAt: string | null;
  assignedByCoachName: string | null;
  progression: ProgramProgression;
  completionStatus: ProgramCompletionStatus;
};

export type MemberProgramsResponse = {
  assignedPrograms: MemberProgramItem[];
  selfStartedPrograms: MemberProgramItem[];
};

type ProgramSessionAgg = {
  sessionsDone: number;
  startedAt: Date | null;
};

function buildProgression(agg?: ProgramSessionAgg): ProgramProgression {
  return {
    sessionsDone: agg?.sessionsDone || 0,
    completionPercent: null
  };
}

function buildCompletionStatus(agg?: ProgramSessionAgg): ProgramCompletionStatus {
  if (!agg || agg.sessionsDone === 0) {
    return "NOT_STARTED";
  }
  return "IN_PROGRESS";
}

export async function getMemberPrograms(gymId: string, userId: string): Promise<MemberProgramsResponse> {
  const member = await prisma.member.findFirst({
    where: { gymId, userId },
    select: { id: true }
  });

  if (!member) {
    return { assignedPrograms: [], selfStartedPrograms: [] };
  }

  const attendanceByProgramRaw = await prisma.attendance.groupBy({
    by: ["programId"],
    where: {
      memberId: member.id,
      programId: { not: null },
      source: "MANUAL"
    },
    _count: { _all: true },
    _min: { checkedInAt: true }
  });

  const attendanceByProgram = new Map<string, ProgramSessionAgg>();
  for (const row of attendanceByProgramRaw) {
    if (!row.programId) {
      continue;
    }
    attendanceByProgram.set(row.programId, {
      sessionsDone: row._count._all,
      startedAt: row._min.checkedInAt
    });
  }

  const assignedProgramsRaw = await prisma.program.findMany({
    where: {
      gymId,
      memberId: member.id
    },
    include: {
      coach: {
        select: { name: true }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  const assignedProgramIds = new Set(assignedProgramsRaw.map((program) => program.id));

  const selfStartedCandidateIds = [...attendanceByProgram.keys()].filter((programId) => !assignedProgramIds.has(programId));

  const selfStartedProgramsRaw =
    selfStartedCandidateIds.length > 0
      ? await prisma.program.findMany({
          where: {
            id: { in: selfStartedCandidateIds },
            gymId,
            memberId: null
          },
          include: {
            coach: {
              select: { name: true }
            }
          },
          orderBy: { updatedAt: "desc" }
        })
      : [];

  const assignedPrograms: MemberProgramItem[] = assignedProgramsRaw.map((program) => {
    const sessionAgg = attendanceByProgram.get(program.id);
    return {
      id: program.id,
      title: program.title,
      description: program.description,
      isPublic: program.isPublic,
      isAssigned: true,
      startedAt: sessionAgg?.startedAt ? sessionAgg.startedAt.toISOString() : null,
      assignedByCoachName: program.coach?.name || null,
      progression: buildProgression(sessionAgg),
      completionStatus: buildCompletionStatus(sessionAgg)
    };
  });

  const selfStartedPrograms: MemberProgramItem[] = selfStartedProgramsRaw.map((program) => {
    const sessionAgg = attendanceByProgram.get(program.id);
    return {
      id: program.id,
      title: program.title,
      description: program.description,
      isPublic: program.isPublic,
      isAssigned: false,
      startedAt: sessionAgg?.startedAt ? sessionAgg.startedAt.toISOString() : null,
      assignedByCoachName: null,
      progression: buildProgression(sessionAgg),
      completionStatus: buildCompletionStatus(sessionAgg)
    };
  });

  return {
    assignedPrograms,
    selfStartedPrograms
  };
}
