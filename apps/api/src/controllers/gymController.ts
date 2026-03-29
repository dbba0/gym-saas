import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

export async function createGym(req: AuthRequest, res: Response) {
  const { name, address, phone } = req.body;

  const gym = await prisma.gym.create({
    data: {
      name,
      address,
      phone
    }
  });

  return res.status(201).json(gym);
}

export async function getCurrentGym(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const gym = await prisma.gym.findUnique({ where: { id: req.auth.gymId } });
  if (!gym) {
    return res.status(404).json({ message: "Gym not found" });
  }

  return res.json(gym);
}

export async function updateCurrentGym(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const gym = await prisma.gym.findUnique({ where: { id: req.auth.gymId } });
  if (!gym) {
    return res.status(404).json({ message: "Gym not found" });
  }

  const updatedGym = await prisma.gym.update({
    where: { id: req.auth.gymId },
    data: req.body
  });

  return res.json(updatedGym);
}
