# Bankimport (open-banking)

De **bankimport** van SlimFact verbindt je echte bankrekeningen via
[open-banking.io](https://open-banking.io). Binnenkomende crediteringen worden
automatisch gematcht tegen openstaande facturen (zie het [hoofdstuk in de
beheerdershandleiding](/nl/guide/administrator#bankimport) voor de dagelijkse
werkwijze). Deze pagina is de **installatiehandleiding** voor self-hosters: wat
draait waar, welke omgevingsvariabelen van belang zijn, en hoe je de API-sleutels
aanmaakt.

## Architectuur

Een aparte service — **banking-api** (`packages/banking-api`,
`@slimfact/banking-api`) — beheert de open-banking.io-referenties en de
banksynchronisatiewachtrij. SlimFact zelf praat nooit rechtstreeks met
open-banking.io en houdt geen lokale banktabellen bij:

```text
┌──────────────┐   tRPC (Bearer key)   ┌──────────────┐   open-banking.io
│ SlimFact api  │ ────────────────────► │ banking-api  │ ◄──── SDK ─────────
└──────────────┘                        └──────────────┘      (credentials)
        ▲                                      │
        └────── bank.sync.* events (WS) ───────┘
```

Banking-api bewaart de volledige rekening- en transactiehistorie in zijn eigen
`open_banking`-schema (gedeelde Postgres), voert de geplande synchronisaties uit
en biedt een met sleutels geauthenticeerde machine-API (`/trpc`) die SlimFact
aanroept voor rekeningen, saldi, transacties, verbindingen en sync-triggers.

## Vereisten

- **Docker** (met BuildKit — de standaard op moderne Docker)
- **Postgres**, bereikbaar vanuit de container. Dezelfde server die SlimFact
  gebruikt is prima; banking-api houdt er zijn eigen `open_banking`-schema op na.
- Een [open-banking.io](https://open-banking.io)-account met je bank(en)
  verbonden, en de geëxporteerde **credentials bundle** (`credentials.json`)
- Toegang tot de gepubliceerde image (of, om zelf te bouwen, een token voor het
  **`@modular-api`-register** — zie stap 1).

## Installatie met Docker

### 1. De image ophalen

Uitgebrachte images staan op GHCR:

```sh
docker pull ghcr.io/simsustech/slimfact-banking-api:latest

# Pin een versie in productie:
docker pull ghcr.io/simsustech/slimfact-banking-api:1.2.3
```

Het pakket staat standaard op privé — wordt de pull geweigerd, authenticeer dan
eerst met een token met `read:packages`:

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-gebruikersnaam> --password-stdin
```

Zelf bouwen vanuit een checkout kan ook (vereist een token voor het private
`@modular-api`-register, want de installatie haalt daar pakketten vandaan):

```sh
docker build \
  --secret id=SIMSUSTECH_NPM_TOKEN,src=env/SIMSUSTECH_NPM_TOKEN \
  --target banking-api \
  -t ghcr.io/simsustech/slimfact-banking-api:local \
  .
```

### 2. Eerste start (bootstrap)

Banking-api authenticeert zijn aanroepers (SlimFact) met API-sleutels uit een
gemount JSON-bestand. Alleen de SHA-256-hash van elke sleutel wordt in de DB
bewaard; het bestand is de bron van waarheid en de start **mislukt
(fail-closed)** als het ontbreekt of ongeldig is. De container kan dus niet
starten zonder.

Sleutels geven toegang tot **specifieke** bankrekeningen. Een lege
`accounts`-lijst geeft **geen** toegang — niet alle toegang. Omdat rekening-id's
pas bestaan nadat er een sync is gedraaid, gaat de configuratie in twee stappen.

Start met een plaatshouder, zodat de container opstart en de eerste data ophaalt:

```sh
printf '{"apiKeys": []}\n' > config.json

export OPENBANKING_CREDENTIALS_JSON=$(base64 -w0 pad/naar/credentials.json)

docker run -d --name banking-api --restart unless-stopped \
  -e API_HOST=banking-api \
  -e POSTGRES_HOST=<host> \
  -e POSTGRES_DB=<db> \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<wachtwoord> \
  -e OPENBANKING_CREDENTIALS_JSON="$OPENBANKING_CREDENTIALS_JSON" \
  -v "$PWD/config.json:/etc/banking-api/config.json:ro" \
  banking-api
```

`API_HOST` is de canonieke hostnaam waarop deze instance bereikbaar is; die moet
overeenkomen met wat SlimFact als `BANKING_API_URL` gebruikt, anders lopen de
OIDC- en event-bus-origins uiteen.

De credentials bundle bevat de P-256-ontsleutelingssleutel en de API-sleutel —
**behandel die als een wachtwoord**. Geef hem via de omgeving door (zoals
hierboven), nooit door hem te committen of in de image te kopiëren.

### 3. De echte configuratie genereren

Zodra de eerste sync rekeningen heeft opgehaald, laat je banking-api de
configuratie zelf genereren — het kiest een sleutel, kent elke gevonden rekening
toe, en print wat SlimFact nodig heeft:

```sh
docker exec banking-api node dist/scripts/bootstrap-config.js /tmp/config.json
docker cp banking-api:/tmp/config.json ./config.json
```

Of, vanuit de broncode tegen dezelfde database:

```sh
pnpm --filter @slimfact/banking-api bootstrap-config ./config.json
```

Het bestand wordt geschreven met mode `0600`. Het weigert een bestaande
configuratie te overschrijven zonder `--force` (wat de sleutel roteert), en het
weigert te draaien voordat er rekeningen bestaan — een lege toekenningslijst zou
stil niets lezen.

### 4. Herstarten om de sleutel toe te passen

```sh
docker restart banking-api
```

Bij het opstarten wordt het bestand met de database verzoend. Daarna:

- `scopes`: `read` en/of `sync`. `sync` geeft toegang tot de sync-trigger.
- `accounts`: de externe rekening-id's waar deze sleutel bij mag.
- `expiresAt`: optioneel — de sleutel werkt hierna niet meer.
- **Roteren/intrekken**: pas het bestand aan en herstart; bij het opstarten worden
  de sleutels met de DB verzoend (aanmaken/bijwerken/heractiveren/intrekken).

### 5. Controleren

```sh
docker logs banking-api                 # migratieregels, dan "listening on 0.0.0.0:80"
docker exec banking-api \
  node -e "fetch('http://localhost/health').then(r=>r.json()).then(console.log)"
# { ok: true, keys: 1 }
```

`keys` is het aantal actieve API-sleutels uit het configuratiebestand — staat daar
`0`, dan is het gemounte bestand niet gevonden of niet geldig.

### 6. SlimFact erop richten

Zet deze op de **SlimFact api**-service:

| Variabele         | Waarde                                                    |
| ----------------- | --------------------------------------------------------- |
| `BANKING_API_URL` | `http://banking-api:3000` (of waar je hem hebt ontsloten) |
| `BANKING_API_KEY` | de `obk_…`-sleutel uit stap 3                             |

Laat beide leeg om de bankimport volledig uit te schakelen — SlimFact verbergt
dan de bank-UI en doet geen aanroepen naar de proxy.

## Met docker-compose

De tweestapsinstallatie hierboven in één bestand, samengevoegd met een bestaande
SlimFact-stack. `banking-api` deelt de `database`-service en is intern
bereikbaar als `banking-api`, dus gepubliceerde poorten zijn niet nodig.

```yaml
services:
  banking-api:
    image: banking-api # lokaal gebouwd: docker build --target banking-api -t banking-api .
    environment:
      API_HOST: banking-api
      # banking-api leest POSTGRES_PASSWORD direct — er is geen _FILE-variant.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: database
      POSTGRES_DB: ${POSTGRES_DB}
      # Base64 van credentials.json. Weglaten betekent bank-sync inert.
      OPENBANKING_CREDENTIALS_JSON: ${OPENBANKING_CREDENTIALS_JSON:-}
      # Optioneel — weglaten tenzij je PSP-uitbetalingen wilt inlezen:
      # MOLLIE_API_KEY: ${MOLLIE_API_KEY:-}
      # STRIPE_API_KEY: ${STRIPE_API_KEY:-}
      BANKING_API_CONFIG_PATH: /etc/banking-api/config.json
    volumes:
      # Begin met {"apiKeys": []} en vervang via bootstrap-config: zie hierboven.
      - ./config.json:/etc/banking-api/config.json:ro
    depends_on:
      database:
        condition: service_healthy
    restart: unless-stopped

  api:
    environment:
      BANKING_API_URL: http://banking-api:80
      BANKING_API_KEY: ${BANKING_API_KEY}
```

Richt `BANKING_API_URL` op de poort waarop de container luistert (`PORT`,
standaard `80`) — beide services delen het compose-netwerk, dus een
gepubliceerde poort is niet nodig.

```sh
docker compose build banking-api
docker compose up -d banking-api api
```

## Draaien migraties automatisch?

**Ja.** Het entrypoint van de image is:

```sh
node dist/src/kysely/migrate.js && node dist/src/server.js
```

Elke containerstart past openstaande migraties toe en serveert daarna. Migraties
zijn idempotent en worden vastgelegd in `open_banking.kysely_migration`, dus
herstarten en rolling deployments zijn veilig — er is geen aparte migratiestap en
geen handmatige `migrate:latest` nodig.

De eerste start maakt het `open_banking`-schema en het pg-boss-queueschema aan.
De image **seedt niets**: seeden is opt-in en alleen de teststack doet het.

## Omgevingsvariabelen

Deployment:

| Variabele                 | Vereist | Standaard                      | Doel                                                                              |
| ------------------------- | ------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `API_HOST`                | ja      | —                              | Canonieke hostnaam van deze banking-api-instance.                                 |
| `POSTGRES_PASSWORD`       | ja      | —                              | Postgres-wachtwoord.                                                              |
| `POSTGRES_DB`             | ja      | —                              | Database (die van SlimFact, bijv. `slimfact`).                                    |
| `POSTGRES_HOST`           | nee     | `localhost`                    | Postgres-host.                                                                    |
| `POSTGRES_PORT`           | nee     | `5432`                         | Postgres-poort.                                                                   |
| `POSTGRES_USER`           | nee     | `postgres`                     | Postgres-gebruiker.                                                               |
| `POSTGRES_POOL_MAX`       | nee     | `3`                            | Max Postgres-verbindingen in de pool.                                             |
| `POSTGRES_SSL`            | nee     | _(uit)_                        | TLS naar Postgres aanzetten.                                                      |
| `POSTGRES_SSL_INSECURE`   | nee     | `false`                        | Certificaatverificatie overslaan — alleen self-signed dev-servers.                |
| `CACERT`                  | nee     | —                              | CA-certificaat om de Postgres-server te verifiëren.                               |
| `BANKING_API_CONFIG_PATH` | nee     | `/etc/banking-api/config.json` | Gemount API-sleutelconfiguratiebestand. **Moet bestaan** — anders faalt de start. |
| `RATE_LIMIT_PER_MINUTE`   | nee     | `600`                          | HTTP-rate limit.                                                                  |
| `PORT` / `HOST`           | nee     | `80` / `0.0.0.0`               | Luisteradres.                                                                     |
| `DEBUG`                   | nee     | —                              | SQL-statements loggen.                                                            |

open-banking.io-sync:

| Variabele                               | Vereist | Standaard          | Doel                                                           |
| --------------------------------------- | ------- | ------------------ | -------------------------------------------------------------- |
| `OPENBANKING_CREDENTIALS_JSON`          | nee\*   | —                  | Base64 van de credentials bundle. Zonder blijft bank-sync uit. |
| `OPENBANKING_API_BASE_URL`              | nee     | SDK-standaard      | Overschrijf de open-banking.io API-basis-URL.                  |
| `OPENBANKING_SYNC_CRON`                 | nee     | `0 */4 7-23 * * *` | Schema voor geplande synchronisaties (cron).                   |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | nee     | `60`               | Minimum aantal seconden tussen syncs.                          |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | nee     | `60`               | Minimum interval tussen syncpogingen.                          |

Optioneel — PSP-uitbetalingen inlezen:

| Variabele                   | Vereist | Standaard         | Doel                                      |
| --------------------------- | ------- | ----------------- | ----------------------------------------- |
| `MOLLIE_API_KEY`            | nee     | —                 | Schakelt Mollie-settlement-sync in (PSP). |
| `STRIPE_API_KEY`            | nee     | —                 | Schakelt Stripe-payout-sync in.           |
| `PSP_SYNC_CRON`             | nee     | `0 30 7-23 * * *` | Schema voor PSP-uitbetalingssync.         |
| `PSP_SYNC_COOLDOWN_SECONDS` | nee     | `60`              | Minimum aantal seconden tussen PSP-syncs. |

\* Zonder referenties start de service gewoon — sleutels, lees-API en de wachtrij
werken, maar elke sync levert een leeg resultaat op en de sync-cron is inert.
Handig om de deployment te controleren voordat je echte bankdata aansluit.

De PSP-sleutels staan los van de bankimport: ze bestaan om PSP-uitbetalingen
tegen bankcrediteringen te matchen. Ze allebei weglaten slaat die stap over.

## Draaien vanuit de broncode

Voor ontwikkeling binnen een checkout kan alles wat de image doet ook direct
gedraaid worden:

```sh
pnpm --filter @slimfact/banking-api install
pnpm --filter @slimfact/banking-api build
pnpm --filter @slimfact/banking-api migrate:latest   # maakt open_banking + pg-boss
pnpm --filter @slimfact/banking-api start            # listening on 0.0.0.0:80
```

`generate-key` en `list-accounts` zijn ook beschikbaar als package-scripts. De
omgevingsvariabelen hierboven gelden ongewijzigd.

## Machine-API

`POST /trpc`, Bearer-sleutel in de `Authorization`-header. Procedures:
`listAccounts`, `getAccount`, `listBalances`, `listTransactions`,
`listConnections`, `getSyncStatus`, `sync` (vereist de `sync`-scope),
`listPspSettlements`, `listPspPayments`. Sync-voortgang wordt gepubliceerd als
`bank.sync.*`-events op de WebSocket op `/ws`.

> De volledige ontwikkelaarsreferentie (alle env-vars, scripts, configuratieschema)
> staat in
> [`packages/banking-api/README.md`](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md).
