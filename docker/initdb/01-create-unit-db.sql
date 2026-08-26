-- Dedicated unit-test database so `pnpm test` (vitest unit specs in
-- packages/api + packages/banking-api) can never wipe the data of a running
-- stack. Runs once on the postgres container's first boot (empty PGDATA);
-- re-create with `docker compose ... down --volumes` to pick it up.
CREATE DATABASE slimfact_unit;