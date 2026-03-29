import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const QR_SCAN_COOLDOWN_MS = 5 * 60 * 1000;

export async function scanAttendance(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { qrToken } = req.body;
  const member = await prisma.member.findFirst({
    where: { qrToken, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Invalid QR" });
  }

  const cooldownStart = new Date(Date.now() - QR_SCAN_COOLDOWN_MS);
  const recentScan = await prisma.attendance.findFirst({
    where: {
      memberId: member.id,
      source: "QR",
      checkedInAt: {
        gte: cooldownStart
      }
    },
    orderBy: { checkedInAt: "desc" }
  });

  if (recentScan) {
    return res.status(409).json({
      message: "QR already scanned in the last 5 minutes.",
      nextAllowedAt: new Date(recentScan.checkedInAt.getTime() + QR_SCAN_COOLDOWN_MS).toISOString()
    });
  }

  const attendance = await prisma.attendance.create({
    data: {
      memberId: member.id,
      source: "QR",
      scannedByUserId: req.auth?.userId
    }
  });

  return res.status(201).json({
    attendance,
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName
    }
  });
}

export async function listAttendance(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  if (req.auth.role === "MEMBER") {
    const member = await prisma.member.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId },
      select: { id: true }
    });
    if (!member) {
      return res.json([]);
    }

    const myAttendance = await prisma.attendance.findMany({
      where: { memberId: member.id },
      include: { member: true },
      orderBy: { checkedInAt: "desc" }
    });
    return res.json(myAttendance);
  }

  const attendance = await prisma.attendance.findMany({
    where: { member: { gymId: req.auth.gymId } },
    include: { member: true },
    orderBy: { checkedInAt: "desc" }
  });

  return res.json(attendance);
}

export async function createMemberAttendance(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const member = await prisma.member.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId },
    select: { id: true, firstName: true, lastName: true }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  const { programId } = req.body as { programId?: string };
  if (programId) {
    const program = await prisma.program.findFirst({
      where: {
        id: programId,
        gymId: req.auth.gymId,
        memberId: member.id
      },
      select: { id: true }
    });
    if (!program) {
      return res.status(403).json({ message: "Program does not belong to this member" });
    }
  }

  const attendance = await prisma.attendance.create({
    data: {
      memberId: member.id,
      source: "MANUAL",
      scannedByUserId: req.auth.userId
    }
  });

  return res.status(201).json({
    attendance,
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName
    }
  });
}
