import { Prisma, type PaymentMethod } from "@prisma/client";
import type { Request, Response } from "express";
import crypto from "crypto";
import { nanoid } from "nanoid";
import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import {
  getPaymentProvider,
  type PaymentState,
  type ProviderWebhookEvent,
  type SenegalMobileMoneyMethod
} from "../services/paymentProvider";
import { applySubscriptionRenewal } from "../services/paymentSubscriptionLifecycle";

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function resolveMember(req: AuthRequest, requestedMemberId?: string) {
  if (!req.auth?.gymId) {
    return null;
  }

  if (req.auth.role === "MEMBER") {
    return prisma.member.findFirst({
      where: { userId: req.auth.userId, gymId: req.auth.gymId }
    });
  }

  if (!requestedMemberId) {
    return null;
  }

  return prisma.member.findFirst({
    where: { id: requestedMemberId, gymId: req.auth.gymId }
  });
}

async function resolveSubscription(gymId: string, subscriptionId?: string) {
  if (!subscriptionId) {
    return null;
  }
  return prisma.subscription.findFirst({
    where: { id: subscriptionId, gymId }
  });
}

async function applyProviderStateToPayment(
  paymentId: string,
  event: ProviderWebhookEvent | { status: PaymentState; providerPaymentId: string | null; failureReason?: string; rawPayload: unknown }
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { member: true }
    });
    if (!existing) {
      return null;
    }

    const wasPaid = existing.status === "PAID";
    const now = new Date();
    const updateData: Prisma.PaymentUpdateInput = {
      status: event.status,
      providerPaymentId: event.providerPaymentId || existing.providerPaymentId,
      failureReason: event.status === "FAILED" || event.status === "CANCELED" ? event.failureReason || null : null,
      providerPayload: toJsonValue(event.rawPayload)
    };

    if (event.status === "PAID") {
      updateData.confirmedAt = now;
      updateData.paidAt = now;
    }

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: updateData
    });

    if (!wasPaid && event.status === "PAID" && existing.subscriptionId) {
      const subscription = await tx.subscription.findFirst({
        where: { id: existing.subscriptionId, gymId: existing.member.gymId }
      });
      if (subscription) {
        await applySubscriptionRenewal(tx, existing.memberId, subscription.id, subscription.durationMonths);
      }
    }

    return updated;
  });
}

function isSenegalMethod(method: PaymentMethod): method is SenegalMobileMoneyMethod {
  return method === "WAVE" || method === "ORANGE_MONEY" || method === "FREE_MONEY";
}

function buildWebhookPayloadHash(req: Request) {
  const rawBody =
    (req as Request & { rawBody?: string }).rawBody ||
    JSON.stringify(req.body && typeof req.body === "object" ? req.body : {});
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

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
      include: { subscription: true },
      orderBy: { paidAt: "desc" }
    });
    return res.json(payments);
  }

  const payments = await prisma.payment.findMany({
    where: { member: { gymId: req.auth.gymId } },
    include: { member: true, subscription: true },
    orderBy: { paidAt: "desc" }
  });

  return res.json(payments);
}

export async function createPayment(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { memberId, subscriptionId, amountCents, method } = req.body as {
    memberId: string;
    subscriptionId?: string;
    amountCents: number;
    method: PaymentMethod;
  };

  const member = await resolveMember(req, memberId);
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  const selectedSubscription = await resolveSubscription(req.auth.gymId, subscriptionId);
  if (subscriptionId && !selectedSubscription) {
    return res.status(400).json({ message: "Invalid subscription for this gym" });
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        memberId: member.id,
        subscriptionId: selectedSubscription?.id,
        amountCents,
        method,
        status: "PAID",
        provider: "INTERNAL",
        confirmedAt: new Date()
      }
    });

    if (selectedSubscription) {
      await applySubscriptionRenewal(tx, member.id, selectedSubscription.id, selectedSubscription.durationMonths);
    }

    return created;
  });

  return res.status(201).json(payment);
}

export async function createPaymentIntent(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const { memberId, subscriptionId, amountCents, method } = req.body as {
    memberId?: string;
    subscriptionId: string;
    amountCents?: number;
    method: PaymentMethod;
  };

  if (!isSenegalMethod(method)) {
    return res.status(400).json({ message: "Only Wave, Orange Money or Free Money are allowed for mobile intent." });
  }

  const member = await resolveMember(req, memberId);
  if (!member) {
    return res.status(404).json({ message: "Member not found" });
  }

  const subscription = await resolveSubscription(req.auth.gymId, subscriptionId);
  if (!subscription) {
    return res.status(400).json({ message: "Invalid subscription for this gym" });
  }

  const gym = await prisma.gym.findUnique({ where: { id: req.auth.gymId } });
  if (!gym) {
    return res.status(404).json({ message: "Gym not found" });
  }

  const provider = getPaymentProvider();
  const internalReference = `pay_${nanoid(18)}`;
  const finalAmount = amountCents && amountCents > 0 ? amountCents : subscription.priceCents;

  const pendingPayment = await prisma.payment.create({
    data: {
      memberId: member.id,
      subscriptionId: subscription.id,
      amountCents: finalAmount,
      method,
      status: "PENDING",
      provider: provider.provider,
      providerReference: internalReference
    }
  });

  try {
    const intent = await provider.createPaymentIntent({
      amountCents: finalAmount,
      currency: "XOF",
      description: `Subscription renewal - ${subscription.name}`,
      customerName: `${member.firstName} ${member.lastName}`.trim(),
      customerEmail: member.email || null,
      customerPhone: member.phone || null,
      gymName: gym.name,
      providerReference: internalReference,
      preferredMethod: method,
      gymId: member.gymId,
      memberId: member.id,
      subscriptionId: subscription.id
    });

    const updated = await prisma.payment.update({
      where: { id: pendingPayment.id },
      data: {
        providerReference: intent.providerReference,
        providerPaymentId: intent.providerPaymentId,
        checkoutUrl: intent.checkoutUrl,
        status: intent.status,
        providerPayload: toJsonValue(intent.rawPayload)
      }
    });

    return res.status(201).json({
      id: updated.id,
      status: updated.status,
      checkoutUrl: updated.checkoutUrl,
      provider: updated.provider,
      method: updated.method,
      amountCents: updated.amountCents
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment intent";
    await prisma.payment.update({
      where: { id: pendingPayment.id },
      data: {
        status: "FAILED",
        failureReason: message
      }
    });
    return res.status(502).json({ message });
  }
}

export async function confirmPayment(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const paymentWhere: Prisma.PaymentWhereInput = {
    id: req.params.id,
    member: { gymId: req.auth.gymId }
  };
  if (req.auth.role === "MEMBER") {
    paymentWhere.member = { gymId: req.auth.gymId, userId: req.auth.userId };
  }

  const payment = await prisma.payment.findFirst({
    where: paymentWhere
  });

  if (!payment) {
    return res.status(404).json({ message: "Payment not found" });
  }

  if (!payment.providerReference || payment.provider === "INTERNAL") {
    return res.status(400).json({ message: "Payment is not linked to an external provider." });
  }

  const provider = getPaymentProvider();
  const result = await provider.confirmPayment(payment.providerReference);
  const updated = await applyProviderStateToPayment(payment.id, result);

  if (!updated) {
    return res.status(404).json({ message: "Payment not found" });
  }

  return res.json(updated);
}

export async function receivePaydunyaWebhook(req: Request, res: Response) {
  const provider = getPaymentProvider();
  const event = provider.parseWebhookEvent(req);
  if (!event) {
    return res.status(400).json({ message: "Invalid webhook payload or signature." });
  }

  const payloadHash = buildWebhookPayloadHash(req);
  let loggedEventId: string | null = null;

  try {
    const logged = await prisma.paymentWebhookEvent.create({
      data: {
        provider: provider.provider,
        eventKey: event.eventKey,
        providerReference: event.providerReference,
        status: event.status,
        payloadHash,
        rawPayload: toJsonValue(event.rawPayload)
      },
      select: { id: true }
    });
    loggedEventId = logged.id;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return res.status(202).json({ ok: true, replayed: true });
    }
    throw error;
  }

  const payment = await prisma.payment.findFirst({
    where: {
      provider: provider.provider,
      providerReference: event.providerReference
    }
  });

  if (!payment) {
    if (loggedEventId) {
      await prisma.paymentWebhookEvent.update({
        where: { id: loggedEventId },
        data: {
          processedAt: new Date()
        }
      });
    }
    return res.status(202).json({ ok: true, ignored: true });
  }

  await applyProviderStateToPayment(payment.id, event);
  if (loggedEventId) {
    await prisma.paymentWebhookEvent.update({
      where: { id: loggedEventId },
      data: {
        paymentId: payment.id,
        processedAt: new Date()
      }
    });
  }
  return res.json({ ok: true });
}
