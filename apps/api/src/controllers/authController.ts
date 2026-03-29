import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";
import { nanoid } from "nanoid";

export async function registerAdmin(req: AuthRequest, res: Response) {
  const { gymName, gymAddress, gymPhone, adminName, email, password } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const gym = await prisma.gym.create({
    data: {
      name: gymName,
      address: gymAddress,
      phone: gymPhone
    }
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      gymId: gym.id,
      role: "ADMIN",
      email,
      passwordHash,
      name: adminName
    }
  });

  const token = signToken({ sub: user.id, role: user.role, gymId: user.gymId });
  return res.json({
    token,
    user: {
      id: user.id,
      role: user.role,
      gymId: user.gymId,
      email: user.email,
      name: user.name
    }
  });
}

export async function login(req: AuthRequest, res: Response) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
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

  const token = signToken({ sub: user.id, role: user.role, gymId: user.gymId });
  return res.json({
    token,
    user: {
      id: user.id,
      role: user.role,
      gymId: user.gymId,
      email: user.email,
      name: user.name
    }
  });
}

export async function registerUser(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { name, email, password, role, firstName, lastName, phone, speciality } = req.body;
  const existing = await prisma.user.findUnique({ where: { email } });
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
