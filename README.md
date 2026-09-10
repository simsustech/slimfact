# SlimFact

> Streamlined invoicing made easy

SlimFact is an **open-source, API-first invoicing engine**. Use it standalone or embed it headlessly into your own software.

- **Self-host for free** or **Cloud at €15/month** — all features, no tiers
- **tRPC API** — type-safe, auto-generated clients
- **Fully customizable** — Typst PDF templates, custom business logic, your own PSPs
- **Online payments** — iDEAL, credit cards via Mollie or Stripe

[Documentation](https://www.slimfact.app) · [Demo](https://demo.slimfact.app) · [Why SlimFact](./packages/docs/comparison.md) · [Pricing](./packages/docs/pricing.md)

---

## Self-Hosted

Requires [Caddy](https://github.com/lucaslorentz/caddy-docker-proxy) and PostgreSQL.

```sh
wget https://raw.githubusercontent.com/simsustech/slimfact/main/docker-compose.yaml
wget https://raw.githubusercontent.com/simsustech/slimfact/main/.env.example -O .env
mkdir env
nano -L .env  # Change environment
nano -L env/POSTGRES_PASSWORD
nano -L env/OTP_SECRET  # openssl rand -base64 32
nano -L env/OIDC_COOKIES_KEYS  # openssl rand -base64 32, comma separated
docker compose up
docker exec -it slimfact-database-1 /bin/sh
MODULARAPI_ADMIN_PASSWORD=yourpassword npm run seed:data
```

Login with `admin@slimfact.app` / `yourpassword`.

---

## Development

SlimFact is built on [Modular API](https://www.simsus.tech/modularapi). Requires private NPM access.

```sh
git clone https://github.com/simsustech/slimfact.git
cd slimfact
pnpm i
docker compose -f docker-compose.dev.yaml up
cd packages/api
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact pnpm run migrate:latest
POSTGRES_PASSWORD="$POSTGRES_PASSWORD" POSTGRES_DB=slimfact pnpm run seed:demo
pnpm run dev
```

---

## License

Copyright © simsustech 2024-present · [ELv2 License](./LICENSE)

## AI
As of June 2026 the development is AI assisted.
