import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
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

export async function listCoaches(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const coaches = await prisma.coach.findMany({
    where: { gymId: req.auth.gymId },
    include: { members: true }
  });
  return res.json(coaches);
}

export async function createCoach(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { name, speciality, bio, email, password } = req.body;
  let userId: string | undefined;

  if ((email && !password) || (!email && password)) {
    return res.status(400).json({ message: "Email and password must be provided together" });
  }

  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        gymId: req.auth.gymId,
        role: "COACH",
        email,
        passwordHash,
        name
      }
    });
    userId = user.id;
  }

  const coach = await prisma.coach.create({
    data: {
      gymId: req.auth.gymId,
      userId,
      name,
      speciality,
      bio
    }
  });

  return res.status(201).json(coach);
}

export async function updateCoach(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const coach = await prisma.coach.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!coach) {
    return res.status(404).json({ message: "Coach not found" });
  }

  const updatedCoach = await prisma.coach.update({
    where: { id: req.params.id },
    data: req.body
  });
  return res.json(updatedCoach);
}

export async function deleteCoach(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const coach = await prisma.coach.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!coach) {
    return res.status(404).json({ message: "Coach not found" });
  }

  await prisma.coach.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}

export async function listCoachMembers(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const coach = await prisma.coach.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId },
    select: { id: true }
  });
  if (!coach) {
    return res.status(404).json({ message: "Coach not found" });
  }

  if (req.auth.role === "COACH") {
    const myCoachId = await getAuthenticatedCoachId(req);
    if (!myCoachId || myCoachId !== coach.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const members = await prisma.member.findMany({
    where: { gymId: req.auth.gymId, coachId: coach.id },
    include: { subscription: true }
  });
  return res.json(members);
}

export async function assignMembersToCoach(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const coach = await prisma.coach.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId },
    select: { id: true }
  });
  if (!coach) {
    return res.status(404).json({ message: "Coach not found" });
  }

  const uniqueMemberIds = Array.from(new Set(req.body.memberIds as string[]));
  const members = await prisma.member.findMany({
    where: { id: { in: uniqueMemberIds }, gymId: req.auth.gymId },
    select: { id: true }
  });

  if (members.length !== uniqueMemberIds.length) {
    return res.status(400).json({ message: "Some members do not belong to this gym" });
  }

  await prisma.member.updateMany({
    where: { id: { in: uniqueMemberIds }, gymId: req.auth.gymId },
    data: { coachId: coach.id }
  });

  const updatedMembers = await prisma.member.findMany({
    where: { id: { in: uniqueMemberIds }, gymId: req.auth.gymId },
    include: { coach: true, subscription: true }
  });

  return res.json({ coachId: coach.id, members: updatedMembers });
}
