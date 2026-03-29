import { Prisma, SubscriptionStatus } from "@prisma/client";

export async function applySubscriptionRenewal(
  tx: Prisma.TransactionClient,
  memberId: string,
  subscriptionId: string,
  durationMonths: number
) {
  const now = new Date();
  const latestSubscription = await tx.memberSubscription.findFirst({
    where: {
      memberId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] }
    },
    orderBy: { endDate: "desc" }
  });

  const startDate =
    latestSubscription && latestSubscription.endDate.getTime() > now.getTime()
      ? new Date(latestSubscription.endDate)
      : now;

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);

  const status = startDate.getTime() > now.getTime() ? SubscriptionStatus.PENDING : SubscriptionStatus.ACTIVE;

  await tx.memberSubscription.create({
    data: {
      memberId,
      subscriptionId,
      startDate,
      endDate,
      status
    }
  });

  await tx.member.update({
    where: { id: memberId },
    data: { subscriptionId }
  });
}
