# Staging Deployment Guide

Objectif: rendre le projet testable publiquement (hors localhost) sans deploy automatique.

## 1) Fichiers d'environnement

Copier puis remplir:

```bash
cp apps/api/.env.staging.example apps/api/.env.staging
cp apps/admin/.env.staging.example apps/admin/.env.staging
cp apps/mobile/.env.staging.example apps/mobile/.env.staging
```

## 2) Variables requises par app

### API (`apps/api/.env.staging`)
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REFRESH_TOKEN_TTL_DAYS`
- `CORS_ORIGIN` (peut contenir plusieurs domaines separes par virgule)
- `API_PUBLIC_BASE_URL`
- `PAYMENT_PROVIDER`
- `PAYMENT_CURRENCY`
- `PAYDUNYA_MODE`
- `PAYDUNYA_MASTER_KEY`
- `PAYDUNYA_PRIVATE_KEY`
- `PAYDUNYA_TOKEN`
- `PAYDUNYA_CALLBACK_URL`
- `PAYDUNYA_RETURN_URL`
- `PAYDUNYA_CANCEL_URL`
- `PAYDUNYA_WEBHOOK_SECRET`
- `PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS` (ex: `300`)

### Admin (`apps/admin/.env.staging`)
- `NEXT_PUBLIC_API_URL` (doit pointer vers l'API publique, ex: `https://api-staging.../api`)

### Mobile (`apps/mobile/.env.staging`)
- `EXPO_PUBLIC_API_URL` (doit pointer vers l'API publique, ex: `https://api-staging.../api`)

## 3) Preflight staging (validation + build)

Le script verifie:
- presence des fichiers `.env.staging`
- variables critiques non vides
- absence de `localhost` / `127.0.0.1`
- build API/Admin + checks TypeScript

Commande:

```bash
npm run staging:prepare
```

## 4) Prisma / DB avant runtime (obligatoire)

Appliquer le schema Prisma sur la base staging avant de lancer l'API:

```bash
npm run staging:db:setup
```

Si tu veux aussi les donnees seed de demo:

```bash
WITH_SEED=1 npm run staging:db:setup
```

## 5) Commandes build/run (exactes)

Build:

```bash
npm run build:staging
```

Run API:

```bash
npm run start:staging:api
```

Run Admin:

```bash
npm run start:staging:admin
```

Run Mobile (Expo tunnel, test public):

```bash
npm run start:staging:mobile
```

Option si vous stockez vos fichiers sous un autre nom:

```bash
API_ENV_FILE=apps/api/.env.staging ADMIN_ENV_FILE=apps/admin/.env.staging npm run build:staging
API_ENV_FILE=apps/api/.env.staging npm run start:staging:api
ADMIN_ENV_FILE=apps/admin/.env.staging npm run start:staging:admin
MOBILE_ENV_FILE=apps/mobile/.env.staging npm run start:staging:mobile
```

## 6) Checklist de deploiement staging

- [ ] Tous les `.env.staging` sont renseignes (pas de placeholders, pas de localhost)
- [ ] DNS/API public resolu et HTTPS actif
- [ ] `DATABASE_URL` pointe vers la base staging
- [ ] `npm run staging:db:setup` execute avec succes
- [ ] `CORS_ORIGIN` contient le domaine admin staging
- [ ] `API_PUBLIC_BASE_URL` = URL API publique
- [ ] Clefs PayDunya sandbox configurees
- [ ] `PAYDUNYA_CALLBACK_URL` accessible publiquement
- [ ] `PAYDUNYA_WEBHOOK_SECRET` configure
- [ ] `PAYDUNYA_WEBHOOK_TOLERANCE_SECONDS` configure
- [ ] `npm run staging:prepare` passe sans erreur
- [ ] Login admin OK, refresh session OK, logout OK
- [ ] Flux mobile coach/member OK via URL API staging
- [ ] Verification multi-tenant OK (`npm run test:tenant:isolation` contre staging si applicable)

## 7) Test terrain Senegal (checklist executable end-to-end)

Pre-requis:
- API, Admin et Mobile demarres sur URLs publiques.
- Clefs PayDunya sandbox actives.
- Endpoint webhook public accessible depuis PayDunya.

Variables shell utiles:

```bash
export API_ROOT="https://api-staging.your-domain.com"
export API_BASE="$API_ROOT/api"
export ADMIN_BASE="https://admin-staging.your-domain.com"
```

### Etape A — Onboarding admin/gym
1. Ouvrir `https://admin-staging.../register`.
2. Completer le wizard et creer un espace.
3. Attendu:
   - creation gym + admin en base
   - page de succes
   - redirection login possible

Verification API rapide:

```bash
curl -s "$API_ROOT/health"
```

### Etape B — Login admin
1. Se connecter sur `/login`.
2. Attendu:
   - dashboard charge
   - endpoints `/api/admin/*` fonctionnent
   - session active sans erreur

Si besoin de verifier token via API:

```bash
curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin_email>","password":"<admin_password>"}'
```

### Etape C — Paiement WAVE
1. Depuis admin, creer une intention de paiement WAVE pour un membre.
2. Ouvrir le `checkoutUrl` PayDunya et simuler paiement sandbox.
3. Attendu:
   - paiement passe de `PENDING` a `PAID` apres webhook/confirmation
   - abonnement membre renouvelle automatiquement

Verification API (avec token admin):

```bash
curl -s -X POST "$API_BASE/payments/intents" \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"memberId":"<member_id>","subscriptionId":"<subscription_id>","method":"WAVE"}'
```

### Etape D — Webhook confirmation
1. Verifier que le webhook est recu sur `POST /api/payments/webhooks/paydunya`.
2. Verifier qu'un replay du meme event ne repasse pas le traitement (`202 replayed`).
3. Verifier qu'une signature invalide retourne `400`.

Test signature invalide:

```bash
curl -i -X POST "https://api-staging.your-domain.com/api/payments/webhooks/paydunya" \
  -H "Content-Type: application/json" \
  -H "x-paydunya-secret: wrong-secret" \
  -d '{"provider_reference":"fake","status":"paid"}'
```

Test replay (meme payload + meme event id):

```bash
curl -i -X POST "https://api-staging.your-domain.com/api/payments/webhooks/paydunya" \
  -H "Content-Type: application/json" \
  -H "x-paydunya-secret: <PAYDUNYA_WEBHOOK_SECRET>" \
  -d '{"event_id":"evt-replay-1","provider_reference":"pay_ref_1","status":"paid"}'

curl -i -X POST "https://api-staging.your-domain.com/api/payments/webhooks/paydunya" \
  -H "Content-Type: application/json" \
  -H "x-paydunya-secret: <PAYDUNYA_WEBHOOK_SECRET>" \
  -d '{"event_id":"evt-replay-1","provider_reference":"pay_ref_1","status":"paid"}'
```

### Etape E — Login member/coach
1. Se connecter sur mobile avec un compte coach.
2. Se deconnecter puis se connecter avec un compte member.
3. Attendu:
   - role COACH -> tabs coach
   - role MEMBER -> tabs member
   - refresh session fonctionne en fond

### Etape F — Reservation (si cours disponibles)
1. Creer un cours via admin.
2. Depuis member mobile, reserver le cours.
3. Attendu:
   - reservation visible en base
   - double reservation bloquee

### Etape G — QR membre (si disponible)
1. Depuis member mobile, afficher QR.
2. Scanner via flow attendance.
3. Attendu:
   - check-in cree
   - double scan < 5 min bloque

### Etape H — Logout / expiration
1. Tester logout admin et logout mobile.
2. Simuler expiration access token (attendre TTL court ou invalider token).
3. Attendu:
   - refresh automatique si refresh token valide
   - sinon redirection login propre
