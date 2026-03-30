import { prisma } from "../lib/prisma";

type MemberAvailableProgramItem = {
  id: string;
  title: string;
  shortDescription: string | null;
  level: string | null;
  durationWeeks: number | null;
  sessionsPerWeek: number | null;
  category: string | null;
  objective: string | null;
  isPublic: boolean;
  locked: boolean;
  accessRestricted: boolean;
  creatorName: string | null;
};

type MemberAvailableProgramsResponse = {
  items: MemberAvailableProgramItem[];
  counts: {
    total: number;
    publicAccessible: number;
    restricted: number;
  };
};

function toShortDescription(description: string | null | undefined) {
  if (!description) {
    return null;
  }
  const normalized = description.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 137)}...`;
}

export async function listAvailableProgramsForMember(gymId: string, userId: string): Promise<MemberAvailableProgramsResponse> {
  const member = await prisma.member.findFirst({
    where: { gymId, userId },
    select: { id: true }
  });

  if (!member) {
    return {
      items: [],
      counts: {
        total: 0,
        publicAccessible: 0,
        restricted: 0
      }
    };
  }

  const startedProgramRows = await prisma.attendance.groupBy({
    by: ["programId"],
    where: {
      memberId: member.id,
      source: "MANUAL",
      programId: { not: null }
    }
  });

  const startedProgramIds = startedProgramRows
    .map((row) => row.programId)
    .filter((programId): programId is string => Boolean(programId));

  const programs = await prisma.program.findMany({
    where: {
      gymId,
      memberId: null,
      id: startedProgramIds.length > 0 ? { notIn: startedProgramIds } : undefined
    },
    include: {
      coach: {
        select: { name: true }
      }
    },
    orderBy: [{ isPublic: "desc" }, { updatedAt: "desc" }]
  });

  const items: MemberAvailableProgramItem[] = programs.map((program) => {
    const accessRestricted = !program.isPublic;
    return {
      id: program.id,
      title: program.title,
      shortDescription: toShortDescription(program.description),
      level: null,
      durationWeeks: null,
      sessionsPerWeek: null,
      category: null,
      objective: null,
      isPublic: program.isPublic,
      locked: accessRestricted,
      accessRestricted,
      creatorName: program.coach?.name || null
    };
  });

  return {
    items,
    counts: {
      total: items.length,
      publicAccessible: items.filter((item) => !item.accessRestricted).length,
      restricted: items.filter((item) => item.accessRestricted).length
    }
  };
}
