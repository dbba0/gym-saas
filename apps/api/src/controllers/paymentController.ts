import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

export async function listPayments(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  if (req.auth.role === "MEMBER") {
    const member = await prisma.member.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
    if (!member) {
      return res.json([]);
    }
    const payments = await prisma.payment.findMany({
      where: { memberId: member.id },
      include: { subscription: true }
    });
    return res.json(payments);
  }

  const payments = await prisma.payment.findMany({
    where: { member: { gymId: req.auth.gymId } },
    include: { member: true, subscription: true }
  });

  return res.json(payments);
}

export async function createPayment(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { memberId, subscriptionId, amountCents, method } = req.body;

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  let selectedSubscription: { id: string; durationMonths: number } | null = null;
  if (subscriptionId) {
    selectedSubscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, gymId: req.auth.gymId }
    });
    if (!selectedSubscription) {
      return res.status(400).json({ message: "Invalid subscription for this gym" });
    }
  }

  const payment = await prisma.payment.create({
    data: {
      memberId,
      subscriptionId: selectedSubscription?.id,
      amountCents,
      method
    }
  });

  // On subscription payment, we extend entitlement and mark current plan.
  if (selectedSubscription) {
    const now = new Date();
    const latestSubscription = await prisma.memberSubscription.findFirst({
      where: {
        memberId: member.id,
        status: { in: ["ACTIVE", "PENDING"] }
      },
      orderBy: { endDate: "desc" }
    });

    const startDate =
      latestSubscription && latestSubscription.endDate.getTime() > now.getTime()
        ? new Date(latestSubscription.endDate)
        : now;

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + selectedSubscription.durationMonths);

    const status = startDate.getTime() > now.getTime() ? "PENDING" : "ACTIVE";

    await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        subscriptionId: selectedSubscription.id,
        startDate,
        endDate,
        status
      }
    });

    await prisma.member.update({
      where: { id: member.id },
      data: { subscriptionId: selectedSubscription.id }
    });
  }

  return res.status(201).json(payment);
}
