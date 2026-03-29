# Sprint Plan - Backlog 40 Tickets

Cadence proposee: 1 semaine par sprint.

## Sprint 1 - Fondation backend
- Tickets: `1, 2, 3, 4, 7, 10`
- Objectif: authentification + multi-tenant operationnel
- Etat backend: `DONE`

## Sprint 2 - Gestion membres
- Tickets: `11, 12, 13, 14, 15, 16`
- Objectif: CRUD membres + regles coach/admin
- Etat backend: `DONE`

## Sprint 3 - Gestion coachs
- Tickets: `17, 18, 19, 20`
- Objectif: coachs et assignation membres
- Etat backend: `DONE`

## Sprint 4 - Programmes fitness
- Tickets: `21, 22, 23, 24, 25`
- Objectif: programmes + progression + lecture mobile
- Etat backend: `DONE`

## Sprint 5 - Paiements
- Tickets: `26, 27, 28, 29`
- Objectif: paiements + renouvellement + expiration
- Etat backend: `DONE`

## Sprint 6 - QR presence
- Tickets: `34, 35, 36`
- Objectif: scan entree salle
- Etat backend: `DONE`

## Sprint 7 - Reservations
- Tickets: `30, 31, 32, 33`
- Objectif: gestion cours collectifs
- Etat backend: `DONE`

## Sprint 8 - Dashboard admin
- Tickets: `37, 38, 39`
- Objectif: statistiques administrateur
- Etat backend: `DONE`

## Bloc transverse
- Ticket `40` (isolation SaaS) est applique sur les routes protegees via `gymId` + middleware `requireGymContext` + controles d'autorisation metier.
