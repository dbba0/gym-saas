import { PrismaClient, Role, PaymentMethod, SubscriptionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

async function main() {
  const existingGym = await prisma.gym.findFirst({
    where: { name: "Atlas Gym" }
  });
  const gym =
    existingGym ||
    (await prisma.gym.create({
      data: {
        name: "Atlas Gym",
        address: "Dakar",
        phone: "+221000000000"
      }
    }));

  const adminPass = await bcrypt.hash("admin123", 10);
  const coachPass = await bcrypt.hash("coach123", 10);
  const memberPass = await bcrypt.hash("member123", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@atlasgym.local" },
    update: {},
    create: {
      gymId: gym.id,
      role: Role.ADMIN,
      email: "admin@atlasgym.local",
      passwordHash: adminPass,
      name: "Admin Atlas"
    }
  });

  const coachUser = await prisma.user.upsert({
    where: { email: "coach@atlasgym.local" },
    update: {},
    create: {
      gymId: gym.id,
      role: Role.COACH,
      email: "coach@atlasgym.local",
      passwordHash: coachPass,
      name: "Coach K"
    }
  });

  const coach = await prisma.coach.upsert({
    where: { userId: coachUser.id },
    update: {},
    create: {
      gymId: gym.id,
      userId: coachUser.id,
      name: "Coach K",
      speciality: "Strength"
    }
  });

  const subscription = await prisma.subscription.upsert({
    where: { id: "basic-monthly" },
    update: {},
    create: {
      id: "basic-monthly",
      gymId: gym.id,
      name: "Monthly",
      priceCents: 20000,
      durationMonths: 1
    }
  });

  const memberUser = await prisma.user.upsert({
    where: { email: "member@atlasgym.local" },
    update: {},
    create: {
      gymId: gym.id,
      role: Role.MEMBER,
      email: "member@atlasgym.local",
      passwordHash: memberPass,
      name: "Awa Diop"
    }
  });

  const member = await prisma.member.upsert({
    where: { userId: memberUser.id },
    update: {},
    create: {
      gymId: gym.id,
      userId: memberUser.id,
      subscriptionId: subscription.id,
      coachId: coach.id,
      qrToken: nanoid(24),
      firstName: "Awa",
      lastName: "Diop",
      phone: "+221111111111",
      email: "member@atlasgym.local"
    }
  });

  const activeHistory = await prisma.memberSubscription.findFirst({
    where: {
      memberId: member.id,
      subscriptionId: subscription.id,
      status: SubscriptionStatus.ACTIVE
    }
  });
  if (!activeHistory) {
    await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        subscriptionId: subscription.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        status: SubscriptionStatus.ACTIVE
      }
    });
  }

  const existingPayment = await prisma.payment.findFirst({
    where: {
      memberId: member.id,
      subscriptionId: subscription.id,
      amountCents: 20000,
      method: PaymentMethod.MOBILE_MONEY
    }
  });
  if (!existingPayment) {
    await prisma.payment.create({
      data: {
        memberId: member.id,
        subscriptionId: subscription.id,
        amountCents: 20000,
        method: PaymentMethod.MOBILE_MONEY
      }
    });
  }

  const existingProgram = await prisma.program.findFirst({
    where: {
      gymId: gym.id,
      coachId: coach.id,
      memberId: member.id,
      title: "Strength Starter"
    }
  });
  const program =
    existingProgram ||
    (await prisma.program.create({
      data: {
        gymId: gym.id,
        coachId: coach.id,
        memberId: member.id,
        title: "Strength Starter",
        description: "Full body focus"
      }
    }));

  const existingExercises = await prisma.exercise.count({
    where: { programId: program.id }
  });
  if (!existingExercises) {
    await prisma.exercise.createMany({
      data: [
        { programId: program.id, name: "Squat", sets: 3, reps: 8, restSeconds: 90 },
        { programId: program.id, name: "Bench Press", sets: 3, reps: 8, restSeconds: 90 },
        { programId: program.id, name: "Row", sets: 3, reps: 10, restSeconds: 60 }
      ]
    });
  }

  const existingProgress = await prisma.progressEntry.findFirst({
    where: {
      memberId: member.id,
      notes: "Baseline"
    }
  });
  if (!existingProgress) {
    await prisma.progressEntry.create({
      data: {
        memberId: member.id,
        weightKg: 68.5,
        bodyFatPct: 21.5,
        notes: "Baseline"
      }
    });
  }

  console.log("Seed complete", { gym: gym.id, admin: adminUser.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
