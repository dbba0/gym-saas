# Gym SaaS (Admin + Coach + Membre)

Application SaaS de gestion de salle de sport avec:
- Mobile `React Native + Expo` (membre + coach)
- Dashboard admin `Next.js`
- API `Node.js + Express`
- Base de donnees `PostgreSQL + Prisma`
- Auth `JWT` avec roles `ADMIN`, `COACH`, `MEMBER`

## Structure
- `apps/api`: API Express + Prisma
- `apps/admin`: interface administrateur Next.js
- `apps/mobile`: application mobile Expo
- `packages/shared`: types partages
- `packages/ui`: tokens UI partages
- `docs`: architecture et API

## Fonctionnalites implementees
- Gestion des membres (CRUD)
- Gestion des coachs (CRUD)
- Gestion des abonnements (CRUD)
- Programmes d'entrainement + exercices
- Suivi des progres (coach/admin -> membre)
- Paiements + historique + renouvellement d'abonnement
- Presence via QR code unique par membre
- Reservation/annulation de cours collectifs
- Statistiques dashboard (membres, coachs, revenus, frequentation)
- Isolation multi-salle (`gymId`) sur les operations backend

## Demarrage rapide
1. Copier les variables d'environnement
```bash
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
```

2. Lancer PostgreSQL
```bash
docker compose up -d
```

3. Installer les dependances
```bash
npm install
```

4. Initialiser la base
```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

5. Lancer les applications
```bash
# depuis la racine du monorepo
npm run dev:api
npm run dev:admin
npm run dev:mobile
```

## Hardening / Demo
- Build pipeline demo: `npm run demo:deploy`
- Smoke test role flows (API): `bash scripts/manual-role-flow.sh`

## Staging public (preparation)
- Guide complet: `docs/staging-deploy.md`
- Script preflight staging: `npm run staging:prepare`
- Setup DB staging (Prisma): `npm run staging:db:setup`
- Build staging: `npm run build:staging`
- Run API staging: `npm run start:staging:api`
- Run Admin staging: `npm run start:staging:admin`
- Run mobile test public (Expo tunnel): `npm run start:staging:mobile`

## Comptes de demo seed
- Admin: `admin@atlasgym.local` / `admin123`
- Coach: `coach@atlasgym.local` / `coach123`
- Membre: `member@atlasgym.local` / `member123`

## URLs locales
- API: `http://localhost:4000`
- Admin: `http://localhost:3000`
- Mobile (Expo): terminal QR Expo

## Endpoints principaux
Voir `docs/api.md`.

## Plan de livraison
Voir `docs/sprint-plan.md`.

## Notes techniques
- Le dashboard admin utilise uniquement le login admin JWT (pas de `ADMIN_TOKEN` cote serveur Next.js).
- Le token mobile est stocke dans `expo-secure-store`.
- Les sessions expirees sont invalidees automatiquement (web + mobile).
- Le membre possede un `qrToken` unique stocke en base.
- Le scan QR cree un enregistrement de presence dans `attendance`, avec anti-double-scan (5 minutes).
- Un paiement avec `subscriptionId` cree l'entree d'historique (`memberSubscriptions`) et met a jour l'abonnement actif du membre.
