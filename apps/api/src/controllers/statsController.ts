import { prisma } from "../lib/prisma";
import type { AuthRequest } from "../middleware/auth";
import type { Response } from "express";

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date: Date) {
  const start = startOfUtcDay(date);
  const dayOfWeek = (start.getUTCDay() + 6) % 7; // Monday = 0
  start.setUTCDate(start.getUTCDate() - dayOfWeek);
  return start;
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

function weekLabel(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  return `${weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

function monthLabel(monthStart: Date) {
  return monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export async function getStats(req: AuthRequest, res: Response) {
  if (!req.auth?.gymId) {
    return res.status(400).json({ message: "Missing gym context" });
  }

  const gymId = req.auth.gymId;
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const attendanceWindowStart = startOfUtcDay(new Date(now));
  attendanceWindowStart.setUTCDate(attendanceWindowStart.getUTCDate() - 55); // 8 weeks coverage

  const monthStart = startOfUtcMonth(now);
  const trendMonthStart = new Date(monthStart);
  trendMonthStart.setUTCMonth(trendMonthStart.getUTCMonth() - 5); // last 6 months

  const [
    memberCount,
    coachCount,
    paymentSum,
    attendanceCount,
    attendanceEvents,
    todayAttendanceCount,
    todayClassesCount,
    todayBookingsCount,
    todayClassesWithReservations,
    activeMemberRows,
    expiredMemberRows,
    recentPayments,
    paymentsForTrend,
    membersForTrend
  ] = await Promise.all([
    prisma.member.count({ where: { gymId } }),
    prisma.coach.count({ where: { gymId } }),
    prisma.payment.aggregate({
      where: {
        member: { gymId },
        paidAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) }
      },
      _sum: { amountCents: true }
    }),
    prisma.attendance.count({ where: { member: { gymId } } }),
    prisma.attendance.findMany({
      where: {
        member: { gymId },
        checkedInAt: { gte: attendanceWindowStart }
      },
      select: { checkedInAt: true }
    }),
    prisma.attendance.count({
      where: {
        member: { gymId },
        checkedInAt: { gte: dayStart, lt: dayEnd }
      }
    }),
    prisma.classSession.count({
      where: {
        gymId,
        startsAt: { gte: dayStart, lt: dayEnd }
      }
    }),
    prisma.classReservation.count({
      where: {
        class: { gymId, startsAt: { gte: dayStart, lt: dayEnd } },
        status: { in: ["RESERVED", "CHECKED_IN"] }
      }
    }),
    prisma.classSession.findMany({
      where: { gymId, startsAt: { gte: dayStart, lt: dayEnd } },
      select: {
        id: true,
        capacity: true,
        reservations: {
          where: { status: { in: ["RESERVED", "CHECKED_IN"] } },
          select: { id: true }
        }
      }
    }),
    prisma.memberSubscription.findMany({
      where: {
        member: { gymId },
        endDate: { gt: now },
        status: { in: ["ACTIVE", "PENDING"] }
      },
      distinct: ["memberId"],
      select: { memberId: true }
    }),
    prisma.memberSubscription.findMany({
      where: {
        member: { gymId },
        endDate: { lte: now }
      },
      distinct: ["memberId"],
      select: { memberId: true }
    }),
    prisma.payment.findMany({
      where: {
        member: { gymId },
        paidAt: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30) }
      },
      select: { memberId: true }
    }),
    prisma.payment.findMany({
      where: {
        member: { gymId },
        paidAt: { gte: trendMonthStart }
      },
      select: { paidAt: true, amountCents: true }
    }),
    prisma.member.findMany({
      where: { gymId },
      select: { createdAt: true }
    })
  ]);

  const activeMemberIds = new Set(activeMemberRows.map((entry) => entry.memberId));
  const expiredMemberCandidates = new Set(expiredMemberRows.map((entry) => entry.memberId));
  const expiredMemberIds = Array.from(expiredMemberCandidates).filter((id) => !activeMemberIds.has(id));
  const recentPaymentMemberIds = new Set(recentPayments.map((payment) => payment.memberId));
  const overduePaymentsCount = expiredMemberIds.filter((id) => !recentPaymentMemberIds.has(id)).length;

  const fullClassesTodayCount = todayClassesWithReservations.filter(
    (session) => session.reservations.length >= session.capacity
  ).length;

  const daily = [] as Array<{ date: string; label: string; count: number }>;
  const dailyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const day = startOfUtcDay(new Date(now));
    day.setUTCDate(day.getUTCDate() - i);
    const key = dateKey(day);
    dailyMap.set(key, 0);
    daily.push({ date: key, label: dayLabel(day), count: 0 });
  }

  const weekly = [] as Array<{ weekStart: string; label: string; count: number }>;
  const weeklyMap = new Map<string, number>();
  const currentWeekStart = startOfUtcWeek(now);
  for (let i = 7; i >= 0; i -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(currentWeekStart.getUTCDate() - i * 7);
    const key = dateKey(weekStart);
    weeklyMap.set(key, 0);
    weekly.push({ weekStart: key, label: weekLabel(weekStart), count: 0 });
  }

  for (const event of attendanceEvents) {
    const day = startOfUtcDay(event.checkedInAt);
    const dayKeyValue = dateKey(day);
    if (dailyMap.has(dayKeyValue)) {
      dailyMap.set(dayKeyValue, (dailyMap.get(dayKeyValue) || 0) + 1);
    }

    const weekStart = startOfUtcWeek(event.checkedInAt);
    const weekKeyValue = dateKey(weekStart);
    if (weeklyMap.has(weekKeyValue)) {
      weeklyMap.set(weekKeyValue, (weeklyMap.get(weekKeyValue) || 0) + 1);
    }
  }

  for (const point of daily) {
    point.count = dailyMap.get(point.date) || 0;
  }
  for (const point of weekly) {
    point.count = weeklyMap.get(point.weekStart) || 0;
  }

  const monthBuckets: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
    revenueCents: number;
    newMembers: number;
    totalMembers: number;
  }> = [];

  for (let i = 0; i < 6; i += 1) {
    const start = new Date(trendMonthStart);
    start.setUTCMonth(trendMonthStart.getUTCMonth() + i);
    const end = new Date(start);
    end.setUTCMonth(start.getUTCMonth() + 1);
    monthBuckets.push({
      key: monthKey(start),
      label: monthLabel(start),
      start,
      end,
      revenueCents: 0,
      newMembers: 0,
      totalMembers: 0
    });
  }

  const monthMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));

  for (const payment of paymentsForTrend) {
    const key = monthKey(payment.paidAt);
    const bucket = monthMap.get(key);
    if (bucket) {
      bucket.revenueCents += payment.amountCents;
    }
  }

  for (const member of membersForTrend) {
    for (const bucket of monthBuckets) {
      if (member.createdAt >= bucket.start && member.createdAt < bucket.end) {
        bucket.newMembers += 1;
      }
      if (member.createdAt < bucket.end) {
        bucket.totalMembers += 1;
      }
    }
  }

  return res.json({
    memberCount,
    coachCount,
    monthlyRevenueCents: paymentSum._sum.amountCents || 0,
    attendanceCount,
    activeMembersCount: activeMemberIds.size,
    todayAttendanceCount,
    todayBookingsCount,
    todayClassesCount,
    alerts: {
      expiredMemberships: expiredMemberIds.length,
      overduePayments: overduePaymentsCount,
      fullClassesToday: fullClassesTodayCount
    },
    attendance: {
      totalCount: attendanceCount,
      daily,
      weekly
    },
    trends: {
      revenue: monthBuckets.map((bucket) => ({
        month: bucket.key,
        label: bucket.label,
        valueCents: bucket.revenueCents
      })),
      members: monthBuckets.map((bucket) => ({
        month: bucket.key,
        label: bucket.label,
        totalMembers: bucket.totalMembers,
        newMembers: bucket.newMembers
      }))
    }
  });
}
