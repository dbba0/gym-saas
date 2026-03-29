# Architecture

## Vue d'ensemble
- `apps/mobile` (Expo): interface membre et coach
- `apps/admin` (Next.js): console d'administration
- `apps/api` (Express): API metier + auth
- PostgreSQL (Prisma): persistance des donnees

Flux principal:
- Client mobile/web -> API Express -> PostgreSQL

## Multi-tenant
- Chaque ressource metier est rattachee a une salle via `gymId`.
- Les controleurs filtrent les donnees par `gymId` pour isoler les salles.

## Authentification et roles
- JWT contient `sub` (user id), `role`, `gymId`.
- Roles pris en charge:
  - `ADMIN`: gestion globale de la salle
  - `COACH`: gestion programmes/progres de ses membres
  - `MEMBER`: consultation perso + reservations

## Donnees
Tables principales demandees:
- `gyms`
- `members`
- `coaches`
- `subscriptions`
- `programs`
- `exercises`
- `payments`
- `attendance`

Tables complementaires:
- `users` (auth)
- `member_subscriptions` (historique/renouvellements)
- `progress_entries` (evolution membre)
- `class_sessions` et `class_reservations` (booking)

## QR code presence
- Chaque membre recoit un `qrToken` unique.
- Le mobile membre affiche son QR.
- Le scan staff (`/attendance/scan`) enregistre l'entree en base.

## Paiements et renouvellements
- `POST /payments` enregistre le paiement.
- Si un `subscriptionId` est fourni:
  - creation d'une entree `member_subscriptions`
  - mise a jour de l'abonnement actif du membre.
