import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

export async function listProgress(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const memberId = req.params.memberId;

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  if (req.auth.role === "MEMBER" && member.userId !== req.auth.userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (req.auth.role === "COACH") {
    const coach = await prisma.coach.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!coach || member.coachId !== coach.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const entries = await prisma.progressEntry.findMany({
    where: { memberId },
    orderBy: { entryDate: "desc" }
  });
  return res.json(entries);
}

export async function createProgress(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { memberId, weightKg, bodyFatPct, notes } = req.body;

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  if (req.auth.role === "COACH") {
    const coach = await prisma.coach.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!coach || member.coachId !== coach.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const entry = await prisma.progressEntry.create({
    data: { memberId, weightKg, bodyFatPct, notes }
  });
  return res.status(201).json(entry);
}

export async function createSelfProgress(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { weightKg, bodyFatPct, notes } = req.body;
  if (weightKg === undefined && bodyFatPct === undefined && !notes) {
    return res.status(400).json({ message: "Provide at least one progress field" });
  }

  const member = await prisma.member.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId },
    select: { id: true }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  const entry = await prisma.progressEntry.create({
    data: {
      memberId: member.id,
      weightKg,
      bodyFatPct,
      notes
    }
  });

  return res.status(201).json(entry);
}
