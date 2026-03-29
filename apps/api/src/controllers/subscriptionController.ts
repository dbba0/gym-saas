import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

async function syncExpiredSubscriptions(memberId: string) {
  const now = new Date();

  await prisma.memberSubscription.updateMany({
    where: {
      memberId,
      status: "PENDING",
      startDate: { lte: now },
      endDate: { gt: now }
    },
    data: { status: "ACTIVE" }
  });

  await prisma.memberSubscription.updateMany({
    where: {
      memberId,
      status: "PENDING",
      endDate: { lte: now }
    },
    data: { status: "EXPIRED" }
  });

  await prisma.memberSubscription.updateMany({
    where: {
      memberId,
      status: "ACTIVE",
      endDate: { lt: now }
    },
    data: { status: "EXPIRED" }
  });
}

async function getMemberSubscriptionSnapshot(memberId: string) {
  await syncExpiredSubscriptions(memberId);

  const history = await prisma.memberSubscription.findMany({
    where: { memberId },
    include: { subscription: true },
    orderBy: [{ endDate: "desc" }, { createdAt: "desc" }]
  });

  const now = new Date();
  const active = history.find(
    (entry) => entry.status === "ACTIVE" && entry.endDate.getTime() > now.getTime()
  );

  return {
    isActive: Boolean(active),
    expiresAt: active?.endDate ?? null,
    activeSubscription: active?.subscription ?? null,
    latest: history[0] ?? null,
    history
  };
}

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

export async function listSubscriptions(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const subs = await prisma.subscription.findMany({
    where: { gymId: req.auth.gymId }
  });
  return res.json(subs);
}

export async function createSubscription(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const subscription = await prisma.subscription.create({
    data: { ...req.body, gymId: req.auth.gymId }
  });
  return res.status(201).json(subscription);
}

export async function updateSubscription(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!subscription) {
    return res.status(404).json({ message: "Subscription not found" });
  }

  const updatedSubscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data: req.body
  });
  return res.json(updatedSubscription);
}

export async function deleteSubscription(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const subscription = await prisma.subscription.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!subscription) {
    return res.status(404).json({ message: "Subscription not found" });
  }

  await prisma.subscription.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}

export async function getMySubscriptionStatus(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const member = await prisma.member.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId },
    select: { id: true }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  const status = await getMemberSubscriptionSnapshot(member.id);
  return res.json(status);
}

export async function getMemberSubscriptionStatus(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const member = await prisma.member.findFirst({
    where: { id: req.params.memberId, gymId: req.auth.gymId },
    select: { id: true, coachId: true }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  if (req.auth.role === "COACH") {
    const coachId = await getAuthenticatedCoachId(req);
    if (!coachId || member.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }
  }

  const status = await getMemberSubscriptionSnapshot(member.id);
  return res.json(status);
}
