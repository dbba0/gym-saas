import { prisma } from "../lib/prisma";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

async function getCoachInGym(gymId: string, coachId: string) {
  return prisma.coach.findFirst({ where: { id: coachId, gymId } });
}

async function getSubscriptionInGym(gymId: string, subscriptionId: string) {
  return prisma.subscription.findFirst({ where: { id: subscriptionId, gymId } });
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

function enrichMemberSubscriptionState(member: any) {
  const now = Date.now();
  const history = Array.isArray(member.subscriptionsHistory) ? member.subscriptionsHistory : [];
  const activeEntry = history.find(
    (entry: any) =>
      (entry.status === "ACTIVE" || entry.status === "PENDING") &&
      new Date(entry.endDate).getTime() > now
  );
  const latestEntry = history[0];

  let subscriptionStatus = "NONE";
  let subscriptionExpiresAt: Date | null = null;
  let activeSubscription = member.subscription || null;

  if (activeEntry) {
    subscriptionStatus = "ACTIVE";
    subscriptionExpiresAt = activeEntry.endDate;
    activeSubscription = activeEntry.subscription || activeSubscription;
  } else if (latestEntry) {
    subscriptionStatus = "EXPIRED";
    subscriptionExpiresAt = latestEntry.endDate;
  }

  const { subscriptionsHistory, ...rest } = member;
  return {
    ...rest,
    activeSubscription,
    subscriptionStatus,
    subscriptionExpiresAt
  };
}

export async function listMembers(req: AuthRequest, res: Response) {
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
      where: { userId: req.auth.userId, gymId: req.auth.gymId },
      include: {
        subscription: true,
        coach: true,
        subscriptionsHistory: {
          include: { subscription: true },
          orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
          take: 6
        }
      }
    });
    if (!member) {
      return res.json([]);
    }
    return res.json([enrichMemberSubscriptionState(member)]);
  }

  const members = await prisma.member.findMany({
    where,
    include: {
      subscription: true,
      coach: true,
      subscriptionsHistory: {
        include: { subscription: true },
        orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
        take: 6
      }
    }
  });
  return res.json(members.map(enrichMemberSubscriptionState));
}

export async function getMember(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const member = await prisma.member.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId },
    include: {
      subscription: true,
      coach: true,
      programs: true,
      subscriptionsHistory: {
        include: { subscription: true },
        orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
        take: 6
      }
    }
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

  return res.json(enrichMemberSubscriptionState(member));
}

export async function createMember(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { firstName, lastName, email, password, phone, subscriptionId, coachId } = req.body;
  let userId: string | undefined;

  if ((email && !password) || (!email && password)) {
    return res.status(400).json({ message: "Email and password must be provided together" });
  }

  if (coachId) {
    const coach = await getCoachInGym(req.auth.gymId, coachId);
    if (!coach) {
      return res.status(400).json({ message: "Invalid coach for this gym" });
    }
  }

  if (subscriptionId) {
    const subscription = await getSubscriptionInGym(req.auth.gymId, subscriptionId);
    if (!subscription) {
      return res.status(400).json({ message: "Invalid subscription for this gym" });
    }
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
        role: "MEMBER",
        email,
        passwordHash,
        name: `${firstName} ${lastName}`
      }
    });
    userId = user.id;
  }

  const member = await prisma.member.create({
    data: {
      gymId: req.auth.gymId,
      userId,
      subscriptionId,
      coachId,
      qrToken: nanoid(24),
      firstName,
      lastName,
      email,
      phone
    }
  });

  return res.status(201).json(member);
}

export async function updateMember(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const member = await prisma.member.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  let updateData: Record<string, unknown> = req.body;

  if (req.auth.role === "COACH") {
    const coachId = await getAuthenticatedCoachId(req);
    if (!coachId || member.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const allowedKeys = ["firstName", "lastName", "email", "phone", "notes"];
    updateData = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedKeys.includes(key))
    );

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No allowed fields to update" });
    }
  }

  if (req.auth.role === "ADMIN") {
    if (req.body.coachId) {
      const coach = await getCoachInGym(req.auth.gymId, req.body.coachId);
      if (!coach) {
        return res.status(400).json({ message: "Invalid coach for this gym" });
      }
    }

    if (req.body.subscriptionId) {
      const subscription = await getSubscriptionInGym(req.auth.gymId, req.body.subscriptionId);
      if (!subscription) {
        return res.status(400).json({ message: "Invalid subscription for this gym" });
      }
    }
  }

  const updatedMember = await prisma.member.update({
    where: { id: req.params.id },
    data: updateData
  });
  return res.json(updatedMember);
}

export async function deleteMember(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const member = await prisma.member.findFirst({
    where: { id: req.params.id, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  await prisma.member.delete({ where: { id: req.params.id } });
  return res.status(204).send();
}

export async function getMyMember(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const member = await prisma.member.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId },
    include: {
      subscription: true,
      coach: true,
      programs: { include: { exercises: true } },
      subscriptionsHistory: {
        include: { subscription: true },
        orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
        take: 6
      }
    }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }
  return res.json(enrichMemberSubscriptionState(member));
}

export async function getMemberQr(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }
  const member = await prisma.member.findFirst({
    where: { userId: req.auth.userId, gymId: req.auth.gymId }
  });
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }
  return res.json({ qrToken: member.qrToken });
}
