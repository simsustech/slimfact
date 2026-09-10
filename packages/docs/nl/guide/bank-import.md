# Bankimport (open-banking)

Met **Bankimport** verbindt SlimFact je echte bankrekeningen via
[open-banking.io](https://open-banking.io). Inkomende crediteringen worden
automatisch gematcht tegen openstaande facturen (zie het [gedeelte in de
Beheerdershandleiding](/nl/guide/administrator#bankimport) voor de dagelijkse
werkwijze). Deze pagina is de **installatiehandleiding** voor self-hosters:
wat draait waar, welke omgevingsvariabelen er toe doen en hoe je de API-sleutels
aanmaakt.

## Architectuur

Een aparte service — **banking-api** (`packages/banking-api`,
`@slimfact/banking-api`) — beheert de open-banking.io-referenties en de
sync-wachtrij. SlimFact zelf communiceert nooit rechtstreeks met
open-banking.io en bewaart geen lokale banktabellen:

```text
┌──────────────┐   tRPC (Bearer-sleutel) ┌──────────────┐   open-banking.io
│ SlimFact api  │ ─────────────────────► │ banking-api  │ ◄──── SDK ─────────
└──────────────┘                         └──────────────┘     (referenties)
        ▲                                      │
        └────── bank.sync.* events (WS) ───────┘
```

Banking-api bewaart de volledige account- en transactiehistorie in een eigen
`open_banking`-schema (gedeelde Postgres), draait de geplande synchronisaties
en biedt een met API-sleutels beveiligde machine-API (`/trpc`) die SlimFact
gebruikt voor accounts, saldi, transacties, verbindingen en sync-triggers.

## Vereisten

- Een [open-banking.io](https://open-banking.io)-account met je bank(en)
  verbonden, en de geëxporteerde **credentials bundle** (`credentials.json`)
- Postgres (dezelfde server die SlimFact gebruikt is prima)
- De samengestelde SlimFact-stack (`docker-compose.test.yaml` / de dump-overlay)
  of een handmatige installatie

## 1. Installeren, bouwen, migreren

```sh
pnpm --filter @slimfact/banking-api install
pnpm --filter @slimfact/banking-api build   # tsc → dist/
pnpm --filter @slimfact/banking-api migrate:latest
```

`migrate:latest` maakt het `open_banking`-schema en het pg-boss
queueschema (`pgboss_banking_v11`) aan. Het heeft de `POSTGRES_*`-variabelen
hieronder nodig.

## 2. Omgevingsvariabelen

| Variabele                               | Vereist | Standaard                      | Doel                                                           |
| --------------------------------------- | ------- | ------------------------------ | -------------------------------------------------------------- |
| `API_HOST`                              | ja      | —                              | Canonieke hostnaam van deze banking-api-instance.              |
| `POSTGRES_PASSWORD`                     | ja      | —                              | Postgres-wachtwoord.                                           |
| `POSTGRES_DB`                           | ja      | —                              | Database (die van SlimFact, bijv. `slimfact_dump`).            |
| `POSTGRES_HOST`                         | nee     | `localhost`                    | Postgres-host.                                                 |
| `POSTGRES_PORT`                         | nee     | `5432`                         | Postgres-poort.                                                |
| `POSTGRES_USER`                         | nee     | `postgres`                     | Postgres-gebruiker.                                            |
| `OPENBANKING_CREDENTIALS_JSON`          | nee*    | —                              | Base64 van de credentials bundle. Zonder blijft bank-sync uit. |
| `OPENBANKING_API_BASE_URL`              | nee     | SDK-standaard                  | Overschrijf de open-banking.io API-basis-URL.                  |
| `OPENBANKING_SYNC_CRON`                 | nee     | `0 */4 7-23 * * *`             | Schema voor geplande synchronisaties (cron).                   |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | nee     | `60`                           | Minimum aantal seconden tussen syncs.                          |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | nee     | `60`                           | Minimum interval tussen syncpogingen.                          |
| `MOLLIE_API_KEY`                        | nee     | —                              | Schakelt Mollie-settlement-sync in (PSP-uitbetalingen).        |
| `STRIPE_API_KEY`                        | nee     | —                              | Schakelt Stripe-payout-sync in.                                |
| `PSP_SYNC_CRON`                         | nee     | `0 30 7-23 * * *`              | Schema voor PSP-uitbetalingssync.                              |
| `BANKING_API_CONFIG_PATH`               | nee     | `/etc/banking-api/config.json` | Gemount API-sleutelconfiguratiebestand.                        |
| `RATE_LIMIT_PER_MINUTE`                 | nee     | `600`                          | HTTP-rate limit.                                               |
| `PORT` / `HOST`                         | nee     | `80` / `0.0.0.0`               | Luisteradres.                                                  |

\* Zonder referenties start de service gewoon — sleutels, lees-API en de
wachtrij werken, maar elke sync levert een leeg resultaat op en de
sync-cron is inert. Dit is de modus die de e2e-teststack gebruikt.

## 3. open-banking.io verbinden

Exporteer de credentials bundle vanuit je open-banking.io-account en geef die
base64-gecodeerd door:

```sh
export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 pad/naar/credentials.json)
```

De bundle bevat de P-256-ontsleutelingssleutel en API-sleutel — **behandel die
als een wachtwoord**. Commit nooit `env/credentials.json` en log de bundle
nooit.

## 4. API-sleutels aanmaken

Banking-api authenticeert machine-callers (SlimFact) met API-sleutels in een
gemount JSON-bestand (`BANKING_API_CONFIG_PATH`). Alleen de SHA-256-hash van
elke sleutel wordt in de DB bewaard; het bestand is de bron van waarheid en de
start mislukt (fail-closed) als het ontbreekt of ongeldig is.

Genereer een sleutel vanuit `packages/banking-api`:

```sh
pnpm generate-key            # testsleutel: obk_test_<43 tekens>
pnpm generate-key live       # livesleutel: obk_live_<43 tekens>
```

Toon de accounts waaraan een sleutel gekoppeld mag worden:

```sh
pnpm list-accounts   # externalId | aspspName | iban
```

Vorm van het configuratiebestand (zie `packages/banking-api/config.example.json`):

```json
{
  "apiKeys": [
    {
      "label": "slimfact-api",
      "key": "obk_test_<plak uit: pnpm generate-key>",
      "scopes": ["read", "sync"],
      "expiresAt": "2030-01-01T00:00:00Z",
      "accounts": ["<external account id uit: pnpm list-accounts>"]
    }
  ]
}
```

- `scopes`: `read` (standaard) en/of `sync`. `sync` geeft toegang tot de
  sync-trigger.
- `accounts`: account-id's waartoe de sleutel toegang heeft; leeg = alle.
- `expiresAt`: optioneel — na dit moment werkt de sleutel niet meer.
- **Roteren/intrekken**: bewerk het bestand en herstart; bij het opstarten
  worden sleutels in de DB verwerkt (aanmaken/bijwerken/reactiveren/intrekken).

Dezelfde sleutel gaat in SlimFacts eigen configuratie als `BANKING_API_URL`
(het adres van de proxy, bijv. `http://banking-api`) en `BANKING_API_KEY`.

## 5. Draaien

```sh
pnpm --filter @slimfact/banking-api start
# [banking-api] listening on 0.0.0.0:80
```

Healthcheck: `GET /health` → `{ "ok": true, "keys": <aantal> }`.

## 6. Docker

De samengestelde stacks mounten de configuratie en referenties via env:

```sh
export SIMSUSTECH_NPM_TOKEN=$(cat env/SIMSUSTECH_NPM_TOKEN)
export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 env/credentials.json)
export MOLLIE_API_KEY=$(cat env/MOLLIE_API_KEY)
docker compose -f docker-compose.test.yaml up -d --wait api banking-api
```

Per-stack sleutelconfiguraties staan in
`packages/banking-api/config.test.json` (gecommit, nodig voor de gedeelde
E2E-stack) en `config.dump.json` (**gitignored** — bevat een echte sleutel,
maak dit lokaal aan vanuit `config.example.json`). Zie
`scripts/verify-slimfact-dump.sh` voor de volledige real-data (dump)-setup.

## Machine-API

`POST /trpc`, Bearer-sleutel in de `Authorization`-header. Procedures:
`listAccounts`, `getAccount`, `listBalances`, `listTransactions`,
`listConnections`, `getSyncStatus`, `sync` (vereist de `sync`-scope),
`listPspSettlements`, `listPspPayments`. Sync-voortgang wordt gepubliceerd als
`bank.sync.*`-events op de WebSocket op `/ws`.

> De volledige ontwikkelaarsreferentie (alle env-vars, scripts,
> configuratieschema) staat in
> [`packages/banking-api/README.md`](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md).
