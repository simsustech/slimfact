# Bankimport (open-banking)

De **bankimport** van SlimFact verbindt je echte bankrekeningen via
[open-banking.io](https://open-banking.io) en matcht binnenkomende crediteringen
tegen openstaande facturen. Deze pagina gaat over de installatie; zie de
[beheerdershandleiding](/nl/guide/administrator#bankimport) voor het dagelijkse
gebruik.

## Architectuur

Een aparte service — **banking-api** — beheert de open-banking.io-referenties en
de synchronisatiewachtrij. SlimFact praat nooit rechtstreeks met open-banking.io
en houdt geen lokale banktabellen bij:

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
aanroept.

## Vereisten

- **Docker** met BuildKit (de standaard op moderne Docker)
- **Postgres**, bereikbaar vanuit de container — die van SlimFact is prima
- Een [open-banking.io](https://open-banking.io)-account met je bank(en)
  verbonden, en de geëxporteerde **credentials bundle**
- Toegang tot de gepubliceerde image, of — om zelf te bouwen — een token voor het
  private `@modular-api`-register (`npm.simsus.tech`)

## Installatie

### 1. De image ophalen

```sh
docker pull ghcr.io/simsustech/slimfact-banking-api:latest

# Pin een versie in productie:
docker pull ghcr.io/simsustech/slimfact-banking-api:1.2.3
```

Het pakket staat op privé — wordt de pull geweigerd, log dan in met een token met
`read:packages`:

```sh
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-gebruikersnaam> --password-stdin
```

Zelf bouwen vanuit een checkout kan ook:

```sh
docker build \
  --secret id=SIMSUSTECH_NPM_TOKEN,src=env/SIMSUSTECH_NPM_TOKEN \
  --target banking-api \
  -t ghcr.io/simsustech/slimfact-banking-api:local \
  .
```

### 2. Starten met een plaatshouder-config

Banking-api authenticeert zijn aanroepers met API-sleutels uit een gemount
JSON-bestand. Alleen de SHA-256-hash van elke sleutel komt in de database, maar
het bestand **moet bestaan** — de start mislukt (fail-closed) zonder.

Sleutels geven toegang tot **specifieke** rekeningen, en rekening-id's bestaan pas
nadat er een sync is gedraaid. Daarom gaat het in twee stappen. Begin met een lege
lijst:

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

`API_HOST` is de hostnaam waarop deze instance bereikbaar is. Die moet
overeenkomen met `BANKING_API_URL` van SlimFact, anders lopen de OIDC- en
event-bus-origins uiteen.

De credentials bundle bevat de P-256-ontsleutelingssleutel — **behandel die als
een wachtwoord**. Geef hem via de omgeving door, nooit door hem te committen of in
een image te bakken.

Migraties draaien automatisch bij het opstarten: het entrypoint van de image is
`migrate.js && server.js`. Ze zijn idempotent en worden bijgehouden in
`open_banking.kysely_migration`, dus herstarten en rolling deploys zijn veilig. De
eerste start maakt het `open_banking`- en het pg-boss-queueschema aan. Er wordt
niets geseed — seeden is alleen voor tests.

### 3. De echte config genereren

Zodra de eerste sync heeft gedraaid, schrijft `bootstrap-config` een complete
config voor je. Het doet drie dingen: het leest de rekeningen die nu in de
database staan, genereert een sleutel (`obk_test_…`, of `obk_live_…` met `live`),
en schrijft een config die die sleutel **al die rekeningen** toekent.

```sh
docker exec banking-api node dist/scripts/bootstrap-config.js /tmp/config.json
docker cp banking-api:/tmp/config.json ./config.json
```

Geschreven met mode `0600`. Het weigert te draaien voordat er rekeningen zijn —
een sleutel met een lege `accounts`-lijst leest **niets**, dus het bestand zou
nutteloos zijn. Het weigert ook een bestaande config te overschrijven zonder
`--force`, wat de sleutel roteert.

Pas het bestand daarna aan om de toekenningen te beperken, terug te brengen tot
één rekening, of een tweede sleutel toe te voegen voor een andere afnemer.

### 4. Herstarten om de sleutel toe te passen

```sh
docker restart banking-api
```

Bij het opstarten wordt het bestand met de database verzoend. Per sleutel:

- `scopes` — `read` en/of `sync`; `sync` geeft toegang tot de sync-trigger
- `accounts` — externe rekening-id's waartoe de sleutel toegang heeft; **leeg betekent geen**
- `expiresAt` — optioneel; de sleutel werkt hierna niet meer

Om te roteren of in te trekken: pas het bestand aan en herstart.

### 5. Controleren en SlimFact erop richten

```sh
docker logs banking-api   # migratieregels, dan "listening on 0.0.0.0:80"
docker exec banking-api \
  node -e "fetch('http://localhost/health').then(r=>r.json()).then(console.log)"
# { ok: true, keys: 1 }
```

`keys` telt de actieve sleutels uit de config — `0` betekent dat het bestand niet
gevonden is of niet valideerde.

Zet daarna deze op de **SlimFact api**-service:

| Variabele         | Waarde                                               |
| ----------------- | ---------------------------------------------------- |
| `BANKING_API_URL` | `http://banking-api:80` (de `PORT` van de container) |
| `BANKING_API_KEY` | de `obk_…`-sleutel uit stap 3                        |

Laat beide leeg om de bankimport volledig uit te schakelen — SlimFact verbergt dan
de bank-UI en doet geen aanroepen naar de proxy.

## Docker Compose

Dezelfde installatie, samengevoegd met een bestaande SlimFact-stack.
`banking-api` deelt de `database`-service en is intern bereikbaar als
`banking-api`, dus publiceert geen poorten.

```yaml
services:
  banking-api:
    image: ghcr.io/simsustech/slimfact-banking-api:latest
    environment:
      API_HOST: banking-api
      # Wordt direct gelezen — banking-api heeft hiervoor geen _FILE-variant.
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: database
      POSTGRES_DB: ${POSTGRES_DB}
      # Base64 van credentials.json. Weglaten betekent bank-sync inert.
      OPENBANKING_CREDENTIALS_JSON: ${OPENBANKING_CREDENTIALS_JSON:-}
      BANKING_API_CONFIG_PATH: /etc/banking-api/config.json
    volumes:
      # Begin met {"apiKeys": []} en vervang via bootstrap-config (stap 3).
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

## PSP-uitbetalingssync (optioneel)

Optioneel, en los van de bankimport — configureer dit alleen als je betalingen
via Mollie of Stripe ontvangt.

**Het probleem dat het oplost.** PSP's betalen niet per transactie uit. Ze
bundelen, en het geld komt dagen later als één bedrag op je bankrekening, netto
na kosten:

```text
Klant betaalt 12 facturen via Mollie  →  Mollie houdt ze vast
                                       → één creditering van €524,18 op je bank
                                         (€537,00 gefactureerd, €12,82 kosten)
```

Voor de matcher van de bankimport is dat een onverklaard bedrag — het matcht geen
enkele factuur, dus het blijft voor altijd in de reviewwachtrij staan.

**Wat de sync doet.** `MOLLIE_API_KEY` / `STRIPE_API_KEY` laten banking-api de
uitbetalingshistorie ophalen naast de bankgegevens, in
`open_banking.psp_settlements` en `psp_payments`:

- **Mollie** — settlements en de betalingen daarbinnen, met de ingehouden kosten
  opgeteld uit de settlementperiodes.
- **Stripe** — payouts en de balanstransacties die aan elke payout hangen.

De matcher herkent een bankcreditering dan als een bekende uitbetaling: hij
matcht op valuta, een datumvenster rond de uitbetalingsdatum, en **het exacte
nettobedrag**. Bij een match wordt het totaal toegerekend aan de individuele
facturen in die uitbetaling, in plaats van ongematcht te blijven.

Laat beide sleutels weg en deze stap wordt volledig overgeslagen — de proxy start
nog steeds en de bankimport werkt normaal.

| Variabele                   | Standaard         | Doel                                              |
| --------------------------- | ----------------- | ------------------------------------------------- |
| `MOLLIE_API_KEY`            | —                 | Mollie-settlements ophalen.                       |
| `STRIPE_API_KEY`            | —                 | Stripe-payouts ophalen.                           |
| `PSP_SYNC_CRON`             | `0 30 7-23 * * *` | Wanneer synchroniseren.                           |
| `PSP_SYNC_COOLDOWN_SECONDS` | `60`              | Minimum seconden tussen runs (pg-boss singleton). |

Syncs upserten en verwijderen nooit, dus de historie groeit en een tweede run
meldt nul nieuwe rijen. Als één PSP faalt wordt dat gelogd en stopt de andere
niet.

## Omgevingsvariabelen

| Variabele                               | Vereist | Standaard                      | Doel                                                                      |
| --------------------------------------- | ------- | ------------------------------ | ------------------------------------------------------------------------- |
| `API_HOST`                              | ja      | —                              | Hostnaam van deze instance; moet matchen met `BANKING_API_URL`.           |
| `POSTGRES_PASSWORD`                     | ja      | —                              | Postgres-wachtwoord.                                                      |
| `POSTGRES_DB`                           | ja      | —                              | Database (die van SlimFact, bijv. `slimfact`).                            |
| `POSTGRES_HOST`                         | nee     | `localhost`                    | Postgres-host.                                                            |
| `POSTGRES_PORT`                         | nee     | `5432`                         | Postgres-poort.                                                           |
| `POSTGRES_USER`                         | nee     | `postgres`                     | Postgres-gebruiker.                                                       |
| `POSTGRES_POOL_MAX`                     | nee     | `3`                            | Grootte van de connection pool.                                           |
| `POSTGRES_SSL`                          | nee     | _(uit)_                        | TLS naar Postgres aanzetten.                                              |
| `POSTGRES_SSL_INSECURE`                 | nee     | `false`                        | Certificaatverificatie overslaan — alleen self-signed dev-servers.        |
| `CACERT`                                | nee     | —                              | CA-certificaat om de Postgres-server te verifiëren.                       |
| `BANKING_API_CONFIG_PATH`               | nee     | `/etc/banking-api/config.json` | API-sleutelconfiguratiebestand. **Moet bestaan** — anders faalt de start. |
| `OPENBANKING_CREDENTIALS_JSON`          | nee\*   | —                              | Base64 credentials bundle. Zonder blijft bank-sync uit.                   |
| `OPENBANKING_API_BASE_URL`              | nee     | SDK-standaard                  | Overschrijf de open-banking.io basis-URL.                                 |
| `OPENBANKING_SYNC_CRON`                 | nee     | `0 */4 7-23 * * *`             | Wanneer bankgegevens synchroniseren.                                      |
| `OPENBANKING_SYNC_COOLDOWN_SECONDS`     | nee     | `60`                           | Minimum seconden tussen syncs.                                            |
| `OPENBANKING_MIN_SYNC_INTERVAL_SECONDS` | nee     | `60`                           | Minimum interval tussen syncpogingen per rekening.                        |
| `RATE_LIMIT_PER_MINUTE`                 | nee     | `600`                          | HTTP-rate limit.                                                          |
| `PORT` / `HOST`                         | nee     | `80` / `0.0.0.0`               | Luisteradres.                                                             |
| `DEBUG`                                 | nee     | —                              | SQL-statements loggen.                                                    |

\* Zonder referenties start de service gewoon — sleutels, lees-API en de wachtrij
werken, maar syncs leveren niets op en de cron is inert. Handig om een deployment
te controleren voordat je echte bankdata aansluit.

## Machine-API

`POST /trpc`, Bearer-sleutel in de `Authorization`-header. Procedures:
`listAccounts`, `getAccount`, `listBalances`, `listTransactions`,
`listConnections`, `getSyncStatus`, `sync` (vereist de `sync`-scope),
`listPspSettlements`, `listPspPayments`. Sync-voortgang wordt gepubliceerd als
`bank.sync.*`-events op de WebSocket op `/ws`.

> De volledige ontwikkelaarsreferentie — alle env-vars, scripts en
> configuratie-opties — staat in
> [`packages/banking-api/README.md`](https://github.com/simsustech/slimfact/blob/main/packages/banking-api/README.md).
