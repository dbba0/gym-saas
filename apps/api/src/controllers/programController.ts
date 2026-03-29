import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

async function getAuthenticatedCoachId(req: AuthRequest) {
  if (!req.auth?.gymId) {
    return null;
  }
  const coach = await prisma.coach.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId },
    select: { id: true }
  });
  return coach?.id ?? null;
}

async function getProgramInGym(req: AuthRequest, programId: string) {
  if (!req.auth?.gymId) {
    return null;
  }
  return prisma.program.findFirst({
    where: { id: programId, gymId: req.auth.gymId }
  });
}

export async function listPrograms(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  let where: any = { gymId: req.auth.gymId };

  if (req.auth.role === "COACH") {
    const coach = await prisma.coach.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!coach) {
      return res.json([]);
    }
    where = { ...where, coachId: coach.id };
  }

  if (req.auth.role === "MEMBER") {
    const member = await prisma.member.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!member) {
      return res.json([]);
    }
    where = { ...where, memberId: member.id };
  }

  const programs = await prisma.program.findMany({
    where,
    include: { exercises: true, coach: true, member: true }
  });

  return res.json(programs);
}

export async function createProgram(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { title, description, memberId, exercises } = req.body;
  let coachId = req.body.coachId as string | undefined;

  if (req.auth.role === "COACH") {
    const coach = await prisma.coach.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!coach) {
      return res.status(403).json({ message: "Coach profile not found" });
    }
    coachId = coach?.id;
  }

  if (coachId) {
    const coach = await prisma.coach.findFirst({
      where: { id: coachId, gymId: req.auth.gymId }
    });
    if (!coach) {
      return res.status(400).json({ message: "Invalid coach for this gym" });
    }
  }

  if (memberId) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, gymId: req.auth.gymId }
    });
    if (!member) {
      return res.status(400).json({ message: "Invalid member for this gym" });
    }
  }

  const program = await prisma.program.create({
    data: {
      gymId: req.auth.gymId,
      coachId,
      memberId,
      title,
      description,
      exercises: exercises
        ? {
            create: exercises.map((ex: any) => ({
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              restSeconds: ex.restSeconds
            }))
          }
        : undefined
    },
    include: { exercises: true }
  });

  return res.status(201).json(program);
}

export async function updateProgram(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const program = await prisma.program.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!program) {
    return res.status(404).json({ message: "Program not found" });
  }

  if (req.auth.role === "COACH") {
    const coach = await prisma.coach.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!coach || program.coachId !== coach.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const updatedProgram = await prisma.program.update({
    where: { id: req.params.id },
    data: req.body
  });
  return res.json(updatedProgram);
}

export async function deleteProgram(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const program = await prisma.program.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!program) {
    return res.status(404).json({ message: "Program not found" });
  }

  if (req.auth.role === "COACH") {
    const coach = await prisma.coach.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!coach || program.coachId !== coach.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  await prisma.program.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}

export async function addExercisesToProgram(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const program = await getProgramInGym(req, req.params.id);
  if (!program) {
    return res.status(404).json({ message: "Program not found" });
  }

  if (req.auth.role === "COACH") {
    const coachId = await getAuthenticatedCoachId(req);
    if (!coachId || program.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const exercises = req.body.exercises as Array<{
    name: string;
    sets: number;
    reps: number;
    restSeconds: number;
  }>;

  await prisma.exercise.createMany({
    data: exercises.map((exercise) => ({
      programId: program.id,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds
    }))
  });

  const updatedProgram = await prisma.program.findUnique({
    where: { id: program.id },
    include: { exercises: true, coach: true, member: true }
  });

  return res.json(updatedProgram);
}

export async function assignProgramToMember(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const program = await getProgramInGym(req, req.params.id);
  if (!program) {
    return res.status(404).json({ message: "Program not found" });
  }

  const memberId = req.body.memberId as string | null;

  if (req.auth.role === "COACH") {
    const coachId = await getAuthenticatedCoachId(req);
    if (!coachId || program.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (memberId) {
      const member = await prisma.member.findFirst({
        where: { id: memberId, gymId: req.auth.gymId },
        select: { coachId: true }
      });
      if (!member) {
        return res.status(400).json({ message: "Invalid member for this gym" });
      }
      if (member.coachId !== coachId) {
        return res.status(403).json({ message: "You can only assign your own members" });
      }
    }
  } else if (memberId) {
    const member = await prisma.member.findFirst({
      where: { id: memberId, gymId: req.auth.gymId },
      select: { id: true }
    });
    if (!member) {
      return res.status(400).json({ message: "Invalid member for this gym" });
    }
  }

  const updatedProgram = await prisma.program.update({
    where: { id: req.params.id },
    data: { memberId },
    include: { exercises: true, coach: true, member: true }
  });

  return res.json(updatedProgram);
}
