import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

export async function listClasses(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const classes = await prisma.classSession.findMany({
    where: { gymId: req.auth.gymId },
    include: { coach: true, reservations: true }
  });
  return res.json(classes);
}

export async function createClass(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const { title, coachId, startsAt, endsAt, capacity } = req.body;

  if (coachId) {
    const coach = await prisma.coach.findFirst({
      where: { id: coachId, gymId: req.auth.gymId }
    });
    if (!coach) {
      return res.status(400).json({ message: "Invalid coach for this gym" });
    }
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return res.status(400).json({ message: "Invalid class dates" });
  }

  const session = await prisma.classSession.create({
    data: {
      gymId: req.auth.gymId,
      coachId,
      title,
      startsAt: start,
      endsAt: end,
      capacity
    }
  });
  return res.status(201).json(session);
}

export async function reserveClass(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const { classId } = req.body;
  const member = await prisma.member.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  const classSession = await prisma.classSession.findFirst({
    where: { id: classId, gymId: req.auth.gymId },
    include: { reservations: true }
  });
  if (!classSession) {
    return res.status(404).json({ message: "Class not found" });
  }

  const existingReservation = classSession.reservations.find(
    (reservation) => reservation.memberId === member.id && reservation.status === "RESERVED"
  );
  if (existingReservation) {
    return res.status(409).json({ message: "Class already reserved" });
  }

  const activeReservations = classSession.reservations.filter(
    (reservation) => reservation.status === "RESERVED" || reservation.status === "CHECKED_IN"
  );
  if (activeReservations.length >= classSession.capacity) {
    return res.status(409).json({ message: "Class is full" });
  }

  const reservation = await prisma.classReservation.create({
    data: { classId, memberId: member.id }
  });
  return res.status(201).json(reservation);
}

export async function cancelReservation(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const reservation = await prisma.classReservation.findFirst({
    where: {
      id: req.params.id,
      class: { gymId: req.auth.gymId }
    },
    include: { member: true }
  });
  if (!reservation) {
    return res.status(404).json({ message: "Reservation not found" });
  }

  if (req.auth.role === "MEMBER" && reservation.member.userId !== req.auth.userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const updatedReservation = await prisma.classReservation.update({
    where: { id: req.params.id },
    data: { status: "CANCELED" }
  });
  return res.json(updatedReservation);
}
