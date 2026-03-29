# API Reference

Base URL: `http://localhost:4000/api`

## Auth
- `POST /auth/register-admin`
- `POST /auth/register-user` (ADMIN)
- `POST /auth/login`
- `GET /auth/me`

## Gyms
- `POST /gyms`
- `GET /gyms/me` (ADMIN, COACH, MEMBER)
- `PATCH /gyms/me` (ADMIN)

## Members
- `GET /members` (ADMIN, COACH)
- `GET /members/:id` (ADMIN, COACH)
- `POST /members` (ADMIN)
- `PATCH /members/:id` (ADMIN, COACH - seulement ses membres assignes)
- `DELETE /members/:id` (ADMIN)
- `GET /members/me` (MEMBER)
- `GET /members/me/qr` (MEMBER)

## Coaches
- `GET /coaches` (ADMIN)
- `POST /coaches` (ADMIN)
- `PATCH /coaches/:id` (ADMIN)
- `GET /coaches/:id/members` (ADMIN, COACH owner)
- `POST /coaches/:id/assign-members` (ADMIN)
- `DELETE /coaches/:id` (ADMIN)

## Subscriptions
- `GET /subscriptions` (ADMIN, COACH, MEMBER)
- `GET /subscriptions/status/my` (MEMBER)
- `GET /subscriptions/status/member/:memberId` (ADMIN, COACH owner)
- `POST /subscriptions` (ADMIN)
- `PATCH /subscriptions/:id` (ADMIN)
- `DELETE /subscriptions/:id` (ADMIN)

## Programs
- `GET /programs` (ADMIN, COACH, MEMBER)
- `POST /programs` (ADMIN, COACH)
- `PATCH /programs/:id` (ADMIN, COACH)
- `POST /programs/:id/exercises` (ADMIN, COACH owner)
- `PATCH /programs/:id/assign` (ADMIN, COACH owner)
- `DELETE /programs/:id` (ADMIN, COACH)

## Progress
- `GET /progress/:memberId` (ADMIN, COACH, MEMBER with access rules)
- `POST /progress` (ADMIN, COACH)
- `POST /progress/self` (MEMBER, enregistre son propre poids/notes)

## Payments
- `GET /payments` (ADMIN, MEMBER)
- `POST /payments` (ADMIN)

## Attendance
- `GET /attendance` (ADMIN, COACH, MEMBER -> MEMBER sees only own attendance)
- `POST /attendance/scan` (ADMIN, COACH)
  - anti-double scan: retourne `409` si le meme membre est scanne dans une fenetre de 5 minutes (`nextAllowedAt` fourni)
- `POST /attendance/self` (MEMBER, valide une session/entrainement)

## Classes / Reservations
- `GET /classes` (ADMIN, COACH, MEMBER)
- `POST /classes` (ADMIN)
- `POST /classes/reserve` (MEMBER)
- `PATCH /classes/reservation/:id/cancel` (MEMBER)

## Stats
- `GET /stats` (ADMIN)
  - KPI dashboard: `activeMembersCount`, `todayBookingsCount`, `todayAttendanceCount`, `todayClassesCount`
  - alertes: `alerts.expiredMemberships`, `alerts.overduePayments`, `alerts.fullClassesToday`
  - tendances: `trends.revenue[6]`, `trends.members[6]`
  - inclut aussi `monthlyRevenueCents`, `attendance.totalCount`, `attendance.daily[7]`, `attendance.weekly[8]`

## Header auth
```http
Authorization: Bearer <jwt_token>
```
