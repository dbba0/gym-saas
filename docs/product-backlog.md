# Product Backlog - Gym SaaS

Statuts:
- `DONE`: implemente cote backend et utilisable.
- `PARTIAL`: backend present mais encore incomplet pour la definition metier.
- `TODO`: non implemente.

## Epic 1 - Authentification
1. `DONE` - endpoint login JWT (`POST /api/auth/login`)
2. `DONE` - endpoint register utilisateur (`POST /api/auth/register-admin`, `POST /api/auth/register-user`)
3. `DONE` - roles `ADMIN` / `COACH` / `MEMBER`
4. `DONE` - middleware auth JWT (`requireAuth`)
5. `DONE` - middleware role (`requireRole`)
6. `PARTIAL` - page login dashboard admin (ecran present, durcissement session web encore a finaliser)

## Epic 2 - Gestion salles (multi-tenant)
7. `DONE` - creer salle (`POST /api/gyms`)
8. `DONE` - modifier salle (`PATCH /api/gyms/me`)
9. `DONE` - associer utilisateurs a `gymId` (creation users/coachs/members)
10. `DONE` - isolation multi-tenant sur les requetes protegees (filtres `gymId` + `requireGymContext`)

## Epic 3 - Gestion membres
11. `DONE` - creer membre (`POST /api/members`)
12. `DONE` - modifier membre (`PATCH /api/members/:id`)
13. `DONE` - supprimer membre (`DELETE /api/members/:id`)
14. `DONE` - lister membres d'une salle (`GET /api/members`)
15. `DONE` - profil detaille membre (`GET /api/members/:id`)
16. `DONE` - assigner coach a membre (`PATCH /api/members/:id` ou `POST /api/coaches/:id/assign-members`)

Regles metier membres:
- `DONE` - ADMIN peut modifier tous les membres de sa salle.
- `DONE` - COACH peut modifier uniquement ses membres assignes.

## Epic 4 - Gestion coachs
17. `DONE` - creer coach (`POST /api/coaches`)
18. `DONE` - modifier coach (`PATCH /api/coaches/:id`)
19. `DONE` - assigner membres a coach (`POST /api/coaches/:id/assign-members`)
20. `DONE` - lister membres d'un coach (`GET /api/coaches/:id/members`)

## Epic 5 - Programmes d'entrainement
21. `DONE` - creer programme (`POST /api/programs`)
22. `DONE` - ajouter exercices (`POST /api/programs/:id/exercises`)
23. `DONE` - assignation manuelle programme -> membre (`PATCH /api/programs/:id/assign`)
24. `DONE` - consultation programme dans app mobile (`GET /api/programs`, role MEMBER)
25. `DONE` - enregistrer progression (`POST /api/progress`)

Contraintes programmes:
- `DONE` - aucune assignation automatique implementee.
- `PARTIAL` - extension future assignation par criteres preparee conceptuellement, moteur de regles non implemente.

## Epic 6 - Paiements
26. `DONE` - enregistrer paiement (`POST /api/payments`)
27. `DONE` - renouveler abonnement apres paiement (historique `member_subscriptions` alimente)
28. `DONE` - historique paiements membre (`GET /api/payments`, role MEMBER)
29. `DONE` - verifier expiration abonnement (`GET /api/subscriptions/status/my`, `GET /api/subscriptions/status/member/:memberId`)

## Epic 7 - Reservations de cours
30. `DONE` - creer cours collectif (`POST /api/classes`)
31. `DONE` - reserver cours (`POST /api/classes/reserve`)
32. `DONE` - limiter capacite (`capacity` verifiee avant reservation)
33. `DONE` - empecher doublons (unicite classe+membre + validation applicative)

## Epic 8 - QR Code presence
34. `DONE` - QR code unique membre (`members.qrToken`, `GET /api/members/me/qr`)
35. `DONE` - scan QR (`POST /api/attendance/scan`)
36. `DONE` - enregistrer presence (`attendance`)

## Epic 9 - Dashboard admin
37. `DONE` - statistiques dashboard (`GET /api/stats`)
38. `DONE` - revenus mensuels (`monthlyRevenueCents` dans `/api/stats`)
39. `DONE` - frequentation salle (detail journalier + hebdomadaire dans `/api/stats`)

## Epic 10 - Infrastructure SaaS
40. `DONE` - isolation multi-tenant backend (controle `gymId`, autorisations et verification des relations inter-entites)

## Sprint mapping (etat backend)
- Sprint 1 (tickets 1,2,3,4,7,10): `DONE`
- Sprint 2 (tickets 11,12,13,14,15,16): `DONE`
- Sprint 3 (tickets 17,18,19,20): `DONE`
- Sprint 4 (tickets 21,22,23,24,25): `DONE`
- Sprint 5 (tickets 26,27,28,29): `DONE`
- Sprint 6 (tickets 34,35,36): `DONE`
- Sprint 7 (tickets 30,31,32,33): `DONE`
- Sprint 8 (tickets 37,38,39): `DONE`
