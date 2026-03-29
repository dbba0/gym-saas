import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";
import { nanoid } from "nanoid";
import type { User } from "@prisma/client";
import {
  generateRefreshTokenValue,
  getRefreshTokenExpiryDate,
  hashRefreshToken,
  readClientMetadata
} from "../services/authSession";

type SupportedCurrency = "XOF" | "USD" | "EUR" | "CAD";
type SetupSubscriptionType = "MONTHLY" | "QUARTERLY" | "YEARLY";
type OnboardingSetup = {
  currency: SupportedCurrency;
  subscriptionTypes: SetupSubscriptionType[];
  estimatedMembers: number | null;
  estimatedCoaches: number | null;
  openingHours: string | null;
};

const ONBOARDING_BASE_PRICE: Record<SupportedCurrency, number> = {
  XOF: 20000,
  USD: 3900,
  EUR: 3500,
  CAD: 4900
};

const ONBOARDING_PLAN_BLUEPRINTS: Record<
  SetupSubscriptionType,
  { label: string; durationMonths: number; multiplier: number }
> = {
  MONTHLY: { label: "Monthly", durationMonths: 1, multiplier: 1 },
  QUARTERLY: { label: "Quarterly", durationMonths: 3, multiplier: 2.7 },
  YEARLY: { label: "Yearly", durationMonths: 12, multiplier: 10 }
};

function normalizeInput(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeInput(value).toLowerCase();
}

function normalizePhone(value: unknown) {
  const raw = normalizeInput(value);
  if (!raw) {
    return null;
  }
  const withLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) {
    return null;
  }
  return `${withLeadingPlus ? "+" : ""}${digits}`;
}

function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function normalizeSetup(setup: unknown): OnboardingSetup {
  const allowedTypes: SetupSubscriptionType[] = ["MONTHLY", "QUARTERLY", "YEARLY"];
  const source = setup && typeof setup === "object" ? (setup as Record<string, unknown>) : {};
  const currencyRaw = String(source.currency || "XOF").toUpperCase();
  const currency: SupportedCurrency =
    currencyRaw === "USD" || currencyRaw === "EUR" || currencyRaw === "CAD" ? currencyRaw : "XOF";
  const typesRaw: string[] = Array.isArray(source.subscriptionTypes)
    ? source.subscriptionTypes.map((item) => String(item).toUpperCase())
    : ["MONTHLY"];
  const uniqueTypes = Array.from(new Set(typesRaw)).filter((type): type is SetupSubscriptionType =>
    allowedTypes.includes(type as SetupSubscriptionType)
  );
  const subscriptionTypes: SetupSubscriptionType[] = uniqueTypes.length > 0 ? uniqueTypes : ["MONTHLY"];

  const estimatedMembers = Number(source.estimatedMembers || 0);
  const estimatedCoaches = Number(source.estimatedCoaches || 0);
  const openingHours = normalizeInput(source.openingHours || "");

  return {
    currency,
    subscriptionTypes,
    estimatedMembers: Number.isFinite(estimatedMembers) && estimatedMembers > 0 ? estimatedMembers : null,
    estimatedCoaches: Number.isFinite(estimatedCoaches) && estimatedCoaches > 0 ? estimatedCoaches : null,
    openingHours: openingHours || null
  };
}

function buildAuthResponse(user: User, accessToken: string, refreshToken: string) {
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      role: user.role,
      gymId: user.gymId,
      email: user.email,
      name: user.name
    }
  };
}

async function issueSessionForUser(user: User, req: AuthRequest) {
  const accessToken = signToken({ sub: user.id, role: user.role, gymId: user.gymId });
  const refreshToken = generateRefreshTokenValue();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const metadata = readClientMetadata(req);
  const now = new Date();

  await prisma.refreshToken.deleteMany({
    where: {
      userId: user.id,
      OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }]
    }
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: getRefreshTokenExpiryDate(),
      createdByIp: metadata.ip,
      userAgent: metadata.userAgent
    }
  });

  return { accessToken, refreshToken };
}

export async function registerAdmin(req: AuthRequest, res: Response) {
  const gymName = normalizeInput(req.body.gymName);
  const gymAddress = normalizeInput(req.body.gymAddress);
  const gymPhone = normalizePhone(req.body.gymPhone);
  const adminName = normalizeInput(req.body.adminName);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const setup = normalizeSetup(req.body.setup);

  if (!gymName || gymName.length < 2) {
    return res.status(400).json({ message: "Gym name is required" });
  }
  if (!adminName || adminName.length < 2) {
    return res.status(400).json({ message: "Admin name is required" });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Valid email is required" });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      message: "Password must include uppercase, lowercase, number and special character."
    });
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const duplicateGym = await prisma.gym.findFirst({
    where: {
      OR: [
        { name: { equals: gymName, mode: "insensitive" } },
        ...(gymPhone ? [{ phone: gymPhone }] : [])
      ]
    },
    select: { id: true, name: true, phone: true }
  });
  if (duplicateGym) {
    return res.status(409).json({ message: "Gym already exists (name or phone already used)." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await prisma.$transaction(async (tx) => {
    const gym = await tx.gym.create({
      data: {
        name: gymName,
        address: gymAddress || null,
        phone: gymPhone
      }
    });

    const user = await tx.user.create({
      data: {
        gymId: gym.id,
        role: "ADMIN",
        email,
        passwordHash,
        name: adminName
      }
    });

    const createdSubscriptions = [];
    for (const type of setup.subscriptionTypes) {
      const blueprint = ONBOARDING_PLAN_BLUEPRINTS[type];
      const basePrice = ONBOARDING_BASE_PRICE[setup.currency];
      const priceCents = Math.round(basePrice * blueprint.multiplier);
      const subscription = await tx.subscription.create({
        data: {
          gymId: gym.id,
          name: `${blueprint.label} (${setup.currency})`,
          durationMonths: blueprint.durationMonths,
          priceCents
        }
      });
      createdSubscriptions.push(subscription);
    }

    return { gym, user, createdSubscriptions };
  });

  const { accessToken, refreshToken } = await issueSessionForUser(result.user, req);
  return res.json({
    ...buildAuthResponse(result.user, accessToken, refreshToken),
    gym: {
      id: result.gym.id,
      name: result.gym.name
    },
    onboarding: {
      status: "READY",
      subscriptionsCreated: result.createdSubscriptions.length,
      setup
    }
  });
}

export async function login(req: AuthRequest, res: Response) {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || "");
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const { accessToken, refreshToken } = await issueSessionForUser(user, req);
  return res.json(buildAuthResponse(user, accessToken, refreshToken));
}

export async function registerUser(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { name, password, role, firstName, lastName, phone, speciality } = req.body;
  const email = normalizeEmail(req.body.email);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      gymId: req.auth.gymId,
      role,
      email,
      passwordHash,
      name
    }
  });

  let profile: Record<string, unknown> | null = null;

  if (role === "COACH") {
    profile = await prisma.coach.create({
      data: {
        gymId: req.auth.gymId,
        userId: user.id,
        name,
        speciality
      }
    });
  }

  if (role === "MEMBER") {
    const [derivedFirstName, ...rest] = name.split(" ");
    const derivedLastName = rest.join(" ").trim();
    profile = await prisma.member.create({
      data: {
        gymId: req.auth.gymId,
        userId: user.id,
        qrToken: nanoid(24),
        firstName: firstName || derivedFirstName || "Member",
        lastName: lastName || derivedLastName || "User",
        phone,
        email
      }
    });
  }

  return res.status(201).json({
    user: {
      id: user.id,
      role: user.role,
      gymId: user.gymId,
      email: user.email,
      name: user.name
    },
    profile
  });
}

export async function refreshSession(req: AuthRequest, res: Response) {
  const refreshToken = String(req.body.refreshToken || "");
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const metadata = readClientMetadata(req);

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!existing || existing.revokedAt || existing.expiresAt.getTime() <= now.getTime()) {
    if (existing && !existing.revokedAt) {
      await prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: now }
      });
    }
    return res.status(401).json({ message: "Refresh token invalid or expired", code: "AUTH_REFRESH_EXPIRED" });
  }

  const user = existing.user;
  if (!user) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now }
    });
    return res.status(401).json({ message: "User not found", code: "AUTH_REFRESH_INVALID" });
  }

  const newRefreshToken = generateRefreshTokenValue();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const accessToken = signToken({ sub: user.id, role: user.role, gymId: user.gymId });

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: now,
        replacedByTokenHash: newRefreshTokenHash
      }
    });

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: getRefreshTokenExpiryDate(),
        createdByIp: metadata.ip,
        userAgent: metadata.userAgent
      }
    });
  });

  return res.json(buildAuthResponse(user, accessToken, newRefreshToken));
}

export async function logout(req: AuthRequest, res: Response) {
  const refreshToken = String(req.body.refreshToken || "");
  const tokenHash = hashRefreshToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });

  return res.json({ ok: true });
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.auth) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({
    id: user.id,
    role: user.role,
    gymId: user.gymId,
    email: user.email,
    name: user.name
  });
}
